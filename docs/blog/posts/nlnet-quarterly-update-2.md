---
comments: true
description: Our second quarterly update about the NLnet funding
date: 2026-01-09
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

# Second NLnet Quarterly Update

![Electron](/assets/images/nlnet-banner.png)

Another NLnet update, a little late because of the holiday season. Although not originally
planned, this quarter was mainly about mobile support. Now that the app works as expected
on web, it makes sense to also support mobile devices.

<!-- more -->

## Mobile enhancements

![Electron](/assets/images/mobile-1.png){width="24%"}
![Electron](/assets/images/mobile-2.png){width="24%"}
![Electron](/assets/images/mobile-3.png){width="24%"}
![Electron](/assets/images/mobile-4.png){width="24%"}

All panels are now rendered within drawers on mobile, to make them easily accessible
through the new bottom navigation bar. The document tabs are hidden under a dropdown, and
the menubar is also collapsed under a hamburger icon button. An ellipsis button was also
added at the bottom of the object toolbar, that triggers the context menu.

[Capacitor](https://capacitorjs.com/) was used to create iOS and Android applications. The
native apps are on closed testing phase, so they are not officially published yet (you can
[read more here](https://github.com/repath-studio/repath-studio/pull/95)).

Multi-touch canvas gestures, like pinch to zoom and pan are now supported. Tools can also
use multi-touch information to change their behavior. For example, we now keep the ratio
locked on scale, when there is more than one active pointer (you can [read more here](https://github.com/repath-studio/repath-studio/pull/116)).

## Language registry

We can now register a new language using the interactive shell

```clojure
(register-language {:id "im-LA"
                    :dir "ltr"
                    :locale "Imaginary language"
                    :code "LA"
                    :dictionary {}})
``` 

We can also register new translations for an existing language

```clojure
(set-translation "en-US" :renderer.menubar.views.file "New File!")
```

You can read more about this [here](https://github.com/repath-studio/repath-studio/pull/102).

## Accessibility filter registry

We can now register a new a11y filter using the interactive shell

```clojure
(register-a11y-filter {:id :blur-x3
                       :tag :feGaussianBlur
                       :label [[:a11y-filter/blur-x3 "blur-x3"]]
                       :attrs {:in "SourceGraphic"
                               :type "matrix"
                               :stdDeviation "3"}})
``` 

More details [here](https://github.com/repath-studio/repath-studio/pull/100).

## [CANCELED] Upgrade to CodeMirror 6

Upgrading to CodeMirror turned out to be extremely involved, with no actual benefit for
the end user. The new version is split into multiple packages, so it's more flexible, but
this modularity requires a lot of modifications, and it doesn't really benefit our use 
case. You can take a look at the initial effort [here](https://github.com/repath-studio/repath-studio/compare/main...codemirror-6).
The upgrade task was suspended in favor of mobile support.
