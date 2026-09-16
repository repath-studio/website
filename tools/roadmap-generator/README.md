# roadmap-generator

> Generate Markdown roadmap files based on Github Issues and Milestone

> **Vendored** — This directory is a local copy of the npm package [`roadmap-generator@0.0.3`](https://www.npmjs.com/package/roadmap-generator) (MIT License, Copyright (c) 2019 Haad), vendored into this repository on 2026-09-16 so that it can be modified locally. It is invoked by the root `generate-roadmap` npm script. Its runtime dependencies are installed at the repository root (see root `package.json` → `devDependencies`).

*Currently uses Github Milestones as milestones and Github Issues as goals*

## Install

```
git clone https://github.com/haadcode/roadmap-generator
cd roadmap-generator
npm install
```

## Usage

*You need a [Github API token](https://help.github.com/articles/creating-an-access-token-for-command-line-use/) to run `roadmap-generator`*

```
Usage: index.js <file> <GITHUB_TOKEN> [options]

By default GITHUB_TOKEN is read from env variable.

Options:
  -g, --goals         Include milestone goals in the roadmap           [boolean]
  -s, --summary       Include milestone summaries in the roadmap       [boolean]
  -p, --progressBars  Show progress with images instead of text
  -l, --log           Log level: DEBUG|ERROR                  [default: "ERROR"]
  -h, --help          Show help                                        [boolean]

Examples:
  index.js roadmap.conf.js               Output a generated roadmap
  index.js roadmap.conf.js > ROADMAP.md  Output the generated roadmap to
                                         ROADMAP.md
  index.js roadmap.conf.js -gs           Generate detailed roadmap
```

Set `GITHUB_TOKEN` environment variable with:

```
export GITHUB_TOKEN=<token>
```
