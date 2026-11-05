const http = require("node:http");

const TARGET_PORT = 3100;
const PROXY_PORT = 6666;

const server = http.createServer((req, res) => {
  const options = {
    hostname: "127.0.0.1",
    port: TARGET_PORT,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: `localhost:${TARGET_PORT}`,
      "x-forwarded-host": `localhost:${PROXY_PORT}`,
      "x-forwarded-port": `${PROXY_PORT}`,
      "x-forwarded-proto": "http",
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on("error", (err) => {
    console.error("Proxy error:", err.message);
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "text/plain" });
      res.end("Bad Gateway - Upstream server unavailable on port 3100");
    }
  });

  req.pipe(proxyReq, { end: true });
});

server.on("upgrade", (req, socket, head) => {
  const proxyReq = http.request({
    hostname: "127.0.0.1",
    port: TARGET_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers,
  });

  proxyReq.on("upgrade", (proxyRes, proxySocket, proxyHead) => {
    socket.write(
      `HTTP/1.1 101 Switching Protocols\r\n` +
        Object.entries(proxyRes.headers)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\r\n") +
        "\r\n\r\n",
    );
    if (proxyHead && proxyHead.length) socket.write(proxyHead);
    proxySocket.pipe(socket);
    socket.pipe(proxySocket);
  });

  proxyReq.on("error", () => socket.destroy());
  proxyReq.end();
});

server.listen(PROXY_PORT, "0.0.0.0", () => {
  console.log(
    `Reverse proxy listening on http://localhost:${PROXY_PORT} -> forwarding to http://127.0.0.1:${TARGET_PORT}`,
  );
});
