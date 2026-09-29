'use strict'

const _ = require('lodash')
const path = require('path')
const Promise = require('bluebird')
const { extendMoment } = require('moment-range')
// moment-range v4 no longer auto-extends moment on require; opt in explicitly.
const moment = extendMoment(require('moment'))
const { Octokit } = require('@octokit/rest')

// Setup command line options
// yargs v17+ exports a factory (and v18 is ESM-only) and no longer parses
// process.argv by default, so the arguments are passed explicitly.
// slice(2) matches process.argv (0 = node, 1 = script path, which yargs
// detects on its own as $0); yargs <= 5 did all of this implicitly.
const yargs = require('yargs')
const argv = yargs(process.argv.slice(2))
  .usage('Usage: $0 <file> <GITHUB_TOKEN> [options]\n\nBy default GITHUB_TOKEN is read from env variable.')
  .demandCommand(1)
  .boolean('g')
  .alias('g', 'goals')
  .describe('g', 'Include milestone goals in the roadmap')
  .boolean('s')
  .alias('s', 'summary')
  .describe('s', 'Include milestone summaries in the roadmap')
  .alias('p', 'progressBars')
  .describe('p', 'Show progress with images instead of text')
  .alias('l', 'log')
  .describe('l', 'Log level: DEBUG|ERROR')
  .default('l', 'ERROR')
  .nargs('l', 1)
  .example('$0 roadmap.conf.js', 'Output a generated roadmap')
  .example('$0 roadmap.conf.js > ROADMAP.md', 'Output the generated roadmap to ROADMAP.md')
  .example('$0 roadmap.conf.js -gs', 'Generate detailed roadmap')
  .help('h')
  .alias('h', 'help')
  .describe('h', 'Show help')
  .argv

// Setup logging
const Logger = require('logplease')
const logger = Logger.create("roadmap-generator", { color: Logger.Colors.Green })
require('logplease').setLogLevel(argv.log || 'ERROR')

// Projects configuration
const roadmap = require(path.resolve(argv._[0]))
// TODO make sure these exist
const projects = roadmap.projects
const organization = roadmap.organization
const milestonesStartDate = roadmap.milestonesStartDate || moment.now()
const milestonesEndDate = roadmap.milestonesEndDate || moment.now()

// Visuals configuration
const symbols = {
  // Issue status
  done: '✔', // completed
  notDone: '⏳', // in progress
  canceled: '❌', // canceled / wontfix
  // Milestone status
  open: '', // active
  closed: '🏁', // completed
  // Milestone details
  progress: '📋', // or 'Progress'
  date: '📅', // or 'Estimated Completion'
}

// Label names (matched case-insensitively) that drive the issue status icons.
// Adjust these to match the labels actually used in the repository.
const CANCELED_LABELS = ['canceled', 'cancelled', 'wontfix']
const IN_PROGRESS_LABELS = ['in progress', 'in-progress', 'in_progress']

// Shown in the Version column for shipped (closed) issues that have not yet
// been cut into a release.
const NEXT_RELEASE = 'upcoming'

// Whether an issue was closed without being shipped (labeled
// canceled/cancelled/wontfix).
function isCanceledIssue(issue) {
  const names = (issue.labels || []).map((label) => label.name.toLowerCase())
  return names.some((name) => CANCELED_LABELS.includes(name))
}

// Status icon for a single issue. Canceled issues get the canceled icon,
// in-progress issues get the notDone icon, completed issues (closed and not
// canceled) keep the done icon, and everything else (open, not started) has
// no icon.
function issueIcon(issue) {
  if (isCanceledIssue(issue))
    return symbols.canceled
  const names = (issue.labels || []).map((label) => label.name.toLowerCase())
  if (names.some((name) => IN_PROGRESS_LABELS.includes(name)))
    return symbols.notDone
  if (issue.state !== 'open')
    return symbols.done
  return ''
}

// Version (release tag) an issue was introduced in. Open issues and issues
// closed without being shipped (labeled canceled/wontfix) have no version.
// Other closed issues map to the first release cut on or after the date they
// were closed (see buildVersionLookup); ones closed after the most recent
// release are marked as "Next release".
function issueVersion(issue, versionFor) {
  if (issue.state === 'open')
    return ''
  if (isCanceledIssue(issue))
    return ''
  if (!issue.closed_at || !versionFor)
    return ''
  return versionFor(issue.closed_at) || NEXT_RELEASE
}

/* GITHUB */

// Github token
const token = process.env.GITHUB_TOKEN || argv._[1] || null
if (!token) {
  logger.error("Error: GITHUB_TOKEN not provided!")
  process.exit(1)
}

// Github API client (official Octokit-based client)
const client = new Octokit({ auth: token })

/* Github data transformation functions */

function getMilestonesListForProject(client, project) {
  logger.log(`-- Generate milestones list for '${project.name}' --`)
  let res = _.cloneDeep(project)
  return Promise.map(project.repos, (repo) => {
    logger.log(`Get milestones from ${repo}`)
    const [owner, name] = repo.split('/')
    return client.request('GET /repos/{owner}/{repo}/milestones', {
      owner: owner,
      repo: name,
      state: 'all',
      sort: 'due_on',
      direction: 'asc'
    })
      .then((res) => res.data)
  }, { concurrency: 16 })
    .then((results) => {
      let milestones = {}
      // Sort milestones: most recent (by due date) first, undated milestones last
      let sorted = _.uniq(_.flatten(results))
      sorted = _.orderBy(sorted, [(m) => (m.due_on ? moment.utc(m.due_on).valueOf() : -Infinity)], ['desc'])

      sorted.forEach((e) => {
        // Filter out milestones that are not within given date range
        const startDate = moment.utc(milestonesStartDate)
        const endDate = moment.utc(milestonesEndDate)
        const range = moment.range(startDate, endDate)
        const due = moment.utc(e.due_on)
        if (due.within(range)) {
          milestones[e.title] = {
            title: e.title,
            description: e.description,
            due_on: e.due_on,
            html_url: e.html_url,
            state: e.state,
            issues: [],
          }
        }
      })
      return milestones
    })
    .then((milestones) => {
      res.milestones = milestones
      return res
    })
}

// The GitHub API clamps per_page to 100, so every page must be fetched
// explicitly or issues beyond the first 100 are silently dropped.
const GITHUB_PAGE_SIZE = 100

function fetchAllIssuesForRepo(client, repo) {
  const [owner, name] = repo.split('/')
  function fetchPage(page) {
    return client.request('GET /repos/{owner}/{repo}/issues', {
      owner: owner,
      repo: name,
      state: 'all',
      per_page: GITHUB_PAGE_SIZE,
      page: page
    })
      .then((res) => {
        if (res.data.length < GITHUB_PAGE_SIZE)
          return res.data
        return fetchPage(page + 1).then((rest) => res.data.concat(rest))
      })
  }
  return fetchPage(1)
}

// Fetch every tag in a repo. The API clamps per_page to 100 (as with issues),
// so pages are fetched until a short page is returned.
function fetchAllTagsForRepo(client, repo) {
  const [owner, name] = repo.split('/')
  function fetchPage(page) {
    return client.request('GET /repos/{owner}/{repo}/tags', {
      owner: owner,
      repo: name,
      per_page: GITHUB_PAGE_SIZE,
      page: page
    })
      .then((res) => {
        if (res.data.length < GITHUB_PAGE_SIZE)
          return res.data
        return fetchPage(page + 1).then((rest) => res.data.concat(rest))
      })
  }
  return fetchPage(1)
}

// Resolve each tag to the date its release commit was made (the moment that
// version was cut) and return a function that maps an issue's close date to
// the first release cut on or after that date i.e. the version the issue
// was introduced in. Issues closed after the most recent release map to ''
// (not yet released).
function buildVersionLookup(client, repo, tags) {
  const [owner, name] = repo.split('/')
  return Promise.map(tags, (tag) => {
    return client.request('GET /repos/{owner}/{repo}/commits/{sha}', {
      owner: owner,
      repo: name,
      sha: tag.commit.sha
    })
      .then((res) => ({
        name: tag.name,
        date: moment.utc(res.data.commit.committer.date)
      }))
  }, { concurrency: 16 })
    .then((releases) => {
      // Oldest release first so the first match is the introducing version.
      releases.sort((a, b) => a.date.valueOf() - b.date.valueOf())
      return (closedAt) => {
        const closed = moment.utc(closedAt).valueOf()
        for (const release of releases) {
          if (release.date.valueOf() >= closed)
            return release.name
        }
        return ''
      }
    })
}

// Sort a milestone's issues: shipped (closed, not canceled) issues come
// first with the most recently closed on top, then open issues (oldest
// created first), with canceled issues at the bottom (most recently closed
// first).
function sortMilestoneIssues(issues) {
  const toTime = (value) => (value ? moment.utc(value).valueOf() : null)
  // Group rank: shipped closed issues first, open issues in the middle,
  // canceled issues last.
  const rank = (issue) => {
    if (isCanceledIssue(issue))
      return 2
    if (issue.state === 'open')
      return 1
    return 0
  }
  issues.sort((a, b) => {
    const aRank = rank(a)
    const bRank = rank(b)
    if (aRank !== bRank)
      return aRank - bRank
    if (aRank === 1) {
      // Order open issues by creation date (oldest first)
      const atA = toTime(a.created_at) || 0
      const atB = toTime(b.created_at) || 0
      return atA - atB
    }
    // Order closed issues by when they were closed (most recent first,
    // missing close dates last)
    const atA = toTime(a.closed_at) || Number.MIN_SAFE_INTEGER
    const atB = toTime(b.closed_at) || Number.MIN_SAFE_INTEGER
    return atB - atA
  })
}

function getAllMilestoneIssues(client, project) {
  logger.log(`-- Generate issues list for '${project.name}' --`)
  let result = _.cloneDeep(project)
  // Release tags are only fetched when the goals are listed, since they are
  // only used to derive the version each goal was introduced in.
  const wantVersions = !!argv.goals
  return Promise.map(project.repos, (repo) => {
    logger.log(`Get issues from ${repo}`)
    const versionPromise = wantVersions
      ? fetchAllTagsForRepo(client, repo).then((tags) => buildVersionLookup(client, repo, tags))
      : Promise.resolve(null)
    return Promise.all([
      fetchAllIssuesForRepo(client, repo),
      versionPromise
    ])
      .then(([issues, versionFor]) => {
        logger.log(`Found ${issues.length} issues in ${repo}`)
        return { repo: repo, issues: issues, versionFor: versionFor }
      })
  }, { concurrency: 16 })
    .then((res) => {
      res.forEach((r) => {
        r.issues.forEach((e) => {
          if (e.milestone) {
            const milestone = result.milestones[e.milestone.title]
            if (milestone) {
              milestone.issues.push({
                title: e.title,
                repo: r.repo,
                html_url: e.html_url,
                repository_url: e.repository_url,
                state: e.state,
                labels: e.labels,
                // Version (release tag) the issue was introduced in, derived
                // from its close date and the repo's release tags.
                version: issueVersion(e, r.versionFor),
                // Kept for ordering only: closed issues are listed in the
                // order they were closed (see sortMilestoneIssues)
                closed_at: e.closed_at,
                created_at: e.created_at
              })
            }
          }
        })
      })
      // List shipped closed issues first (most recent first), open issues
      // next, canceled issues last
      Object.keys(result.milestones).forEach((k) => sortMilestoneIssues(result.milestones[k].issues))
      return result
    })
}

function getMilestoneProgress(project) {
  let res = _.cloneDeep(project);
  res.milestones = Object.keys(project.milestones).map((k) => {
    let ms = _.cloneDeep(project.milestones[k])
    let total = ms.issues.length
    let open = ms.issues.filter((b) => b.state === 'open').length
    let closed = ms.issues.filter((b) => b.state !== 'open').length
    ms.open_issues = open
    ms.total_issues = total
    ms.closed_issues = closed
    return ms
  })
  return res
}

/* Markdown output functions */

const nameToAnchor = (name) => name.split(' ').join('-').toLowerCase()

function generateMilestonesSummary(project, options) {
  let opts = options || { useVisualProgressBars: false }

  let str = `#### Milestone Summary\n\n`
  str += `| Status | Milestone | Goals | ETA |\n`
  str += `| :---: | :--- | :---: | :---: |\n`

  str += Object.keys(project.milestones).map((k, i) => {
    const m = project.milestones[k]
    const progressPercentage = Math.floor((m.closed_issues / (Math.max(m.closed_issues + m.open_issues, 1))) * 100)

    let milestone = ''
    // Marker class so extra.css can highlight the active milestone row
    milestone += `| <span>${m.state === 'open' ? symbols.open : symbols.closed}</span> `
    milestone += `| **[${m.title}](#${nameToAnchor(m.title)})** `

    if (opts.useVisualProgressBars)
      milestone += `| ![Progress](http://progressed.io/bar/${progressPercentage}) `
    else
      milestone += `| ${m.closed_issues} / ${m.total_issues} `

    milestone += `| ${moment.utc(m.due_on).format('MMM DD YYYY')} `
    milestone += `|\n`
    return milestone
  }).join('')
  str += '\n'

  return str
}

function dataToMarkdown(projects, options) {
  let opts = options || { listGoalsPerMilestone: false, displayProjectName: true, useVisualProgressBars: false }

  const res = projects.map((project) => {
    let str = opts.displayProjectName ? `## ${project.name}\n\n` : ''

    // Status section
    if (project.links && project.links.status)
      str += project.links.status

    // Milestone summary
    if (opts.includeMilestoneSummary) {
      str += generateMilestonesSummary(project, options)
    }

    // Milestones header
    if (!opts.displayProjectName)
      str += "## Milestones and Goals\n\n"

    // Milestones for the project
    str += Object.keys(project.milestones).map((k, i) => {
      let m = project.milestones[k]
      const progressPercentage = Math.floor((m.closed_issues / (Math.max(m.closed_issues + m.open_issues, 1))) * 100)
      const t = m.html_url.split('/')
      t.pop()
      t.pop()

      let milestone = `#### ${m.title}\n\n`
      milestone += `> ${m.description}\n\n`

      milestone += (m.state === 'open' ? symbols.open : symbols.closed) + ` &nbsp;**${m.state.toUpperCase()}** &nbsp;&nbsp;`
      milestone += `${symbols.progress} &nbsp;&nbsp;**${m.closed_issues} / ${m.total_issues}** goals completed **(${progressPercentage}%)** &nbsp;&nbsp;`
      milestone += `${symbols.date} &nbsp;&nbsp;**${moment.utc(m.due_on).format('MMM DD YYYY')}**\n\n`

      if (opts.listGoalsPerMilestone) {
        milestone += `| Status | Goal | Version |\n`
        milestone += `| :---: | :--- | :---: |\n`
        milestone += m.issues.map((issue, idx) => {
          let text = `| ${issueIcon(issue)} `
          text += `| [${issue.title}](${issue.html_url}) `
          text += issue.version ? `| \`${issue.version}\`` : '| '
          text += '|\n'
          return text
        }).join('') + '\n'
      } else {
        milestone += `See [milestone goals](https://waffle.io/${roadmap.targetRepo}?milestone=${encodeURIComponent(m.title)}) for the list of goals this milestone has.`
      }

      milestone += `\n`
      return milestone
    }).join('')

    return str
  })
  return res.join('')
}

// WIP
function generateTableOfContents(projects) {
  let res = ''
  res += projects.map((e, i) => {
    let str = `${i + 1}. [${e.name}](${nameToAnchor(e.name)})\n`
    str += e.milestones
      ? Object.keys(e.milestones).map((k) => {
        const m = e.milestones[k]
        return `  - [${m.title}](${nameToAnchor(m.title)})\n`
      }).join('')
      : ''

    return str
  }).join('')

  return res
}

/* Main */

Promise.all(projects.map((project, i) => getMilestonesListForProject(client, project)))
  .then((res) => Promise.all(res.map((e) => getAllMilestoneIssues(client, e))))
  .then((projectsWithIssues) => projectsWithIssues.map((project) => getMilestoneProgress(project)))
  .then((final) => {
    /* FINAL OUTPUT */
    logger.debug("Output:")

    console.log(`# Roadmap`)
    console.log("")
    console.log(`This page describes the current status and the upcoming milestones of the project.`)
    console.log("")

    // console.log("## Table of Contents\n")
    // console.log(generateTableOfContents(projectsWithIssues))

    // console.log("## Projects")
    // console.log("")
    // final.forEach((project) => console.log(`- [${project.name}](#${project.name})`))
    // console.log("")

    const output = dataToMarkdown(final, {
      displayProjectName: projects.length > 1,
      listGoalsPerMilestone: argv.goals,
      includeMilestoneSummary: argv.summary,
      useVisualProgressBars: argv.progressBars,
    })
    console.log(output)
  })
  .catch((e) => logger.error(e))
