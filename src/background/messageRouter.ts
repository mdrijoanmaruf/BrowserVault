/**
 * Central message router for the background service worker
 */

type MessageHandler = (payload: any) => Promise<any> | any;

export class MessageRouter {
  private handlers = new Map<string, MessageHandler>();

  /**
   * Registers a handler for a specific action type
   */
  on(action: string, handler: MessageHandler) {
    this.handlers.set(action, handler);
  }

  /**
   * Listens to chrome.runtime.onMessage and routes accordingly
   */
  listen() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message && message.action) {
        const handler = this.handlers.get(message.action);
        if (handler) {
          // Wrap the handler execution to properly support async handlers
          // returning true from this listener indicates we will send a response asynchronously
          Promise.resolve(handler(message.payload))
            .then(response => {
              sendResponse({ success: true, data: response });
            })
            .catch(error => {
              sendResponse({ success: false, error: error.message || String(error) });
            });
            
          return true; // Keep the message channel open for the async response
        }
      }
      return false;
    });
  }
}
