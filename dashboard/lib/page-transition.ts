import type { MouseEvent } from "react";

type Navigator = { push: (href: string) => void };

const LEAVE_MS = 180;
let running = false;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function transitionNavigate(router: Navigator, href: string): void {
  if (running) return;
  const root = document.querySelector<HTMLElement>(".shell, .corridor-root");
  if (!root || prefersReducedMotion()) {
    router.push(href);
    return;
  }
  running = true;
  let left = false;
  const go = () => {
    if (left) return;
    left = true;
    window.clearTimeout(timer);
    root.removeEventListener("animationend", onEnd);
    router.push(href);
    window.setTimeout(() => {
      running = false;
    }, 400);
  };
  const onEnd = (event: AnimationEvent) => {
    if (event.target !== root) return;
    go();
  };
  const timer = window.setTimeout(go, LEAVE_MS + 40);
  root.addEventListener("animationend", onEnd);
  root.classList.add("page-leave");
}

export function onTransitionClick(router: Navigator, href: string) {
  return (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    transitionNavigate(router, href);
  };
}
