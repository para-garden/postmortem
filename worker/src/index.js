const PAGES_ORIGIN = "https://postmortem-boz.pages.dev";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Redirect /postmortem to /postmortem/ so relative paths resolve correctly
    if (url.pathname === "/postmortem") {
      url.pathname = "/postmortem/";
      return Response.redirect(url.toString(), 301);
    }

    // Strip /postmortem prefix and fetch from Pages
    const path = url.pathname.replace(/^\/postmortem/, "") || "/";
    const pagesUrl = new URL(path + url.search, PAGES_ORIGIN);

    const response = await fetch(pagesUrl, {
      method: request.method,
      headers: request.headers,
    });

    // Pass through with immutable headers copied
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  },
};
