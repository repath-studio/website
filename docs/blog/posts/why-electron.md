---
date: 2025-12-05
tags:
  - Devlog
  - Electron
categories:
  - Devlog
authors: 
  - Konstantinos
---

# Why Electron?

![Electron](/assets/images/electron.png)

There's been significant criticism about the size and the memory footprint of
[Electron](https://www.electronjs.org/) based applications the past years. In fact, there
is so much hate going towards this platform, that I feel the need to defend it, since I
find it quite useful. I am not saying it’s the perfect solution for everything. Those are
legitimate concerns, but as usual, it's all about trade-offs.

The first thing we need to answer though is not about Electron. It’s about web-based
applications in general.

## So why choose to create a web-based application in the first place?

I think a lot of people underestimate the amount of problems that browsers solve these
days on our behalf for free. Web is a rich, secure, and extremely accessible platform. We
now have APIs that provide access to
[File System](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API),
[GPU](https://developer.mozilla.org/en-US/docs/Web/API/GPU),
[Geolocation](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation),
[IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API), and
[many many more](https://developer.mozilla.org/en-US/docs/Web/API). The best part is that
all of  that is cross platform, and the implementation is abstracted away from the
developer by the browser. It is also extremely secure, compared to raw hardware access,
since every sensitive request needs to be approved by the user.

Creating a decent user interface for a cross platform application is also a huge
undertaking. UI frameworks have their cons, but maintaining a single implementation for a
consistent UI across multiple operating systems is a big deal. The application might not
feel native, but it’s a viable alternative. So many applications are now available on
Linux because of that.

Modern Javascript frameworks also help with state management, and a lot of devs are
already familiar with them. For our specific case, using a web-app to create SVGs, ensures
that what you see while editing, is as close as possible to what you are going to get when
you open your creations on a browser. We also don’t have to render anything ourselves, or
try to implement quirky conversions.

## Why not serve a simple website then?

Because we want to provide a standalone offline application. Electron’s ecosystem also has
the necessary tooling to help you package the application for the operating systems of
your choice. That’s a big deal, if you don’t want to spend the a substantial amount of
your time packaging the app for all major linux package managers. Unfortunately, solutions
like Flatpak and Snap couldn’t fix this problem. They made the list longer.

## Can’t we just serve a progressive web-app?

[PWAs](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps) were a nice
idea, that didn’t really work out in practice. The main reason was that the concept was
never properly supported or promoted. If you don’t believe me, you can try to install a
web-application (add to home screen) on iOS. Because of that, most people don’t even know
what a PWA is. It's an evolving situation, but we are not there yet.

## What about Tauri?

[Tauri’s biggest selling point](http://v2.tauri.app/start/#why-tauri) is that it
dramatically reduces the size of the binary, by using the native webview of the system.
The problem with that, is that we also lose one of the biggest advantages of Electron,
which bundles a Chromium based webview. The amount of confidence that we get from that is
invaluable in my opinion. The alternative, is to make sure that our app works as intended
on every major browser. This adds significant burden, especially if you are using modern
APIs that might not be currently supported.

Rust could be a plus for certain developers, but if you don’t have any prior experience,
it would add another language to your stack. Electron is also more mature and battle
tested.

As a Linux user, I would take the extra disk size and memory hit, if the alternative is no
application at all. If you want to read when not to use Electron, you can check the
[corresponding section on their documentation](https://www.electronjs.org/docs/latest/why-electron#why-choose-something-else).
