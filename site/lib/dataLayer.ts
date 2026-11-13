declare global {
  interface Window {
    dataLayer: unknown[];
  }
}

// window.dataLayer is created once by the head script, before the container.
// Client code only pushes to it, never reassigns it.

// Same shape as the classic snippet: pushes the arguments object, which is
// what Google's tag reads for consent commands.
export function gtag(_command: string, _action: string, _params?: object): void {
  window.dataLayer.push(arguments);
}

export function push(event: Record<string, unknown>): void {
  window.dataLayer.push(event);
}
