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
  // Milestone status
  open: '🚀', // active
  closed: '🏁', // completed
  // Milestone details
  progress: '📋', // or 'Progress'
  date: '📅', // or 'Estimated Completion'
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

function getAllMilestoneIssues(client, project) {
  logger.log(`-- Generate issues list for '${project.name}' --`)
  let result = _.cloneDeep(project)
  return Promise.map(project.repos, (repo) => {
    logger.log(`Get issues from ${repo}`)
    return fetchAllIssuesForRepo(client, repo)
      .then((issues) => {
        logger.log(`Found ${issues.length} issues in ${repo}`)
        return { repo: repo, issues: issues }
      })
  }, { concurrency: 16 })
    .then((res) => {
      res.forEach((repo) => {
        repo.issues.forEach((e) => {
          if (e.milestone) {
            const milestone = result.milestones[e.milestone.title]
            if (milestone) {
              milestone.issues.push({
                title: e.title,
                repo: repo.repo,
                html_url: e.html_url,
                repository_url: e.repository_url,
                state: e.state,
                labels: e.labels
              })
            }
          }
        })
      })
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
    milestone += `| <span class="milestone-state milestone-state-${m.state}">${m.state === 'open' ? symbols.open : symbols.closed}</span> `
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
        milestone += `| Status | Goal | Labels |\n`
        milestone += `| :---: | :--- | --- |\n`
        milestone += m.issues.map((issue, idx) => {
          let text = `| ${issue.state === 'open' ? symbols.notDone : symbols.done} `
          text += `| [${issue.title}](${issue.html_url}) `
          text += issue.labels.length > 0 ? `| ` + issue.labels.map((label) => `\`${label.name}\``).join(', ') : '| '
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
