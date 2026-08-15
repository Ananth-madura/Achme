const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  app.use(
    "/api",
    createProxyMiddleware({
      target: "http://localhost:5000",
      changeOrigin: true,
      onError: (err, req, res) => {
        if (!res.headersSent) {
          res.status(502).json({
            error: "Backend Unavailable",
            message: "The backend server at http://localhost:5000 is initializing or unreachable.",
            details: err.message
          });
        }
      }
    })
  );
};