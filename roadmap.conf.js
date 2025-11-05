'use strict'

module.exports = {
  // Name of the organization or project this roadmap is generated for
  organization: 'Repath Studio',

  // Include open and closed milestones where due date is after milestonesStartDate
  milestonesStartDate: '2020-01-01T00:00:00Z', // ISO formatted timestamp

  // Include open and closed milestones where due date is before milestonesEndDate
  milestonesEndDate: '2026-11-01T00:00:00Z', // ISO formatted timestamp

  // Github repository to open a Pull Request with the generated roadmap
  targetRepo: "repath-studio/repath-studio",

  // List of projects that this roadmap covers
  projects: [
    {
      name: "Repath Studio",
      repos: [
        "repath-studio/repath-studio",
      ],
    },
  ]
}
