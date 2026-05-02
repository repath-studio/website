---
comments: true
description: Our second quarterly update about the NLnet funding
date: 2026-05-02
tags:
  - NLnet
categories:
  - NLnet Funding
authors: 
  - Konstantinos
links:
  - NLnet Project Page: https://nlnet.nl/project/RepathStudio/
---

# Third NLnet Quarterly Update

![Electron](/assets/images/nlnet-banner-light.svg#only-light)
![Electron](/assets/images/nlnet-banner-dark.svg#only-dark)

Our third NLnet update, introducing a guide tool, adjustable anchor points, and more
extensibility enhancements.

<!-- more -->

## Guide tool

![Guide](/assets/images/guide.png)

A guide tool that allows creating guides on documents was introduced. Users can create a
guide by dragging the horizontal or the vertical ruler on the canvas. They can also click
on the ruler and then click on the canvas. Locking the guides disables all interactions
with guides, and the hide toggle hides all guides. Initiating a guide creation
automatically unlocks guides and makes them visible (you can [read more here](https://github.com/repath-studio/repath-studio/pull/129)).

The guides can be snapped on existing elements on create. Snapping elements on guides will
be handled on a subsequent enhancement, because the snapping module cannot handle snap on
axis yet.

## Adjustable anchor points

![Pivot point](/assets/images/pivot-point.png)

Introduced an adjustable pivot handle at the center of the element selection. Users can
move the point and  scale the selection holding `shift` down to scale using the anchor
point. In the future, this will also be  used to rotate on the custom anchor point.
Custom pivot positions are preserved until the element selection changes. Holding `x` down
while moving the anchor point should snap it to various selection points (you can [read
more here](https://github.com/repath-studio/repath-studio/pull/132)).


## Extensibility enhancements

The following registries where introduced

- Action registry [#119](https://github.com/repath-studio/repath-studio/pull/119)
- Action groups registry [#120](https://github.com/repath-studio/repath-studio/pull/120)
- Icon registry [#117](https://github.com/repath-studio/repath-studio/pull/117)

You can take a look at the corresponding PRs for more info.

## [CANCELED] Using a different library for boolean operations

The available options seem inferior to paper.js, and we also don't have a way to replace
`stroke->path`, so we can't get rid of the dependency if we want to keep this
functionality. Putting this on hold for now.
