
type MessageHandler = (payload: any) => Promise<any> | any;

export class MessageRouter {
  private handlers = new Map<string, MessageHandler>();

  on(action: string, handler: MessageHandler) {
    this.handlers.set(action, handler);
  }

  listen() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message && message.action) {
        const handler = this.handlers.get(message.action);
        if (handler) {
          Promise.resolve(handler(message.payload))
            .then(response => {
              sendResponse({ success: true, data: response });
            })
            .catch(error => {
              sendResponse({ success: false, error: error.message || String(error) });
            });
            
          return true; 
        }
      }
      return false;
    });
  }
}
