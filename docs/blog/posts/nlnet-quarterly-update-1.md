---
date: 2025-09-12
tags:
  - NLnet
  - Devlog
categories:
  - NLnet Funding
  - Devlog
authors: 
  - Konstantinos
links:
  - NLnet Project Page: https://nlnet.nl/project/RepathStudio/
---

# NLnet Quarterly Update

Since June 2025, this project is funded through [NGI0 Commons Fund](https://nlnet.nl/commonsfund),
a fund established by [NLnet](https://nlnet.nl) with financial support from the European
Commission's [Next Generation Internet](https://ngi.eu) program. This is the first
quarterly update that aims to inform the public about the progress of the project. The
following enhancements were included in this period with the help of the NLnet foundation.

<!-- more -->

## Internationalization support

The application is now translatable
(you can [read more here](https://github.com/repath-studio/repath-studio/pull/87)).
Big thanks to [Christos](https://github.com/WonderlustKing) for handling the initial
implementation!

![Language Menu](/assets/images/language-menu.png)

## Export to rasterized image

Users can now export the document to various rasterized image formats
(you can [read more here](https://github.com/repath-studio/repath-studio/pull/89)).

![Export Menu](/assets/images/export-menu.png)

## Font enhancements

Users can now convert text elements to paths on web. This functionality was previously
available on the electron app only. In order to do that, we use web APIs to get to the
font data, and we also bundle a font with the app, to correctly convert text elements
with the default font
(you can [read more here](https://github.com/repath-studio/repath-studio/pull/84)).

## Persist enhancements

We now use [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) to
preserve the applications state when we close the app. Local storage had limitations
(like size) that blocked users from using the app for more heavy work
(you can [read more here](https://github.com/repath-studio/repath-studio/pull/86)).

You can now also keep track of the progress on our [roadmap](/roadmap/ROADMAP.md).
