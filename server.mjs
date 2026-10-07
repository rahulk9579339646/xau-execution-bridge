import express from "express";

const app = express();

app.use(express.json());

/* =========================================================
   CONFIG
========================================================= */

const PORT = process.env.PORT || 10000;

const SOURCE_BOT_URL =
  process.env.SOURCE_BOT_URL ||
  "https://xau-ai-bot-1.onrender.com";

/*
   Last signal cache
*/
let lastSignal = null;

/*
   Last fetch information
*/
let lastFetch = null;

/* =========================================================
   CORS
   Liquid Chart browser requests require CORS.
========================================================= */

app.use((req, res, next) => {
  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

/* =========================================================
   HEALTH
========================================================= */

app.get("/", (req, res) => {
  res.json({
    success: true,
    service: "XAU Execution Bridge",
    status: "running",
    sourceBot: SOURCE_BOT_URL,
    time: new Date().toISOString()
  });
});

/* =========================================================
   GET AI SIGNAL
========================================================= */

app.get("/signal", async (req, res) => {
  try {

    /* -----------------------------------------------------
       Fetch source bot
    ----------------------------------------------------- */

    const response = await fetch(
      `${SOURCE_BOT_URL}/mtf-analysis`,
      {
        method: "GET",
        headers: {
          "Accept": "application/json"
        }
      }
    );

    if (!response.ok) {
      throw new Error(
        `Source bot HTTP ${response.status}`
      );
    }

    const data = await response.json();

    lastFetch = new Date().toISOString();

    /* -----------------------------------------------------
       Read confirmation
    ----------------------------------------------------- */

    const confirmation =
      data?.ENTRY_CONFIRMATION || {};

    const levels =
      data?.TRADE_LEVELS || {};

    const status =
      String(
        confirmation.status || ""
      ).toUpperCase();

    /* -----------------------------------------------------
       Only confirmed signals are executable
    ----------------------------------------------------- */

    let direction = null;

    if (status === "BUY CONFIRMED") {
      direction = "BUY";
    }

    if (status === "SELL CONFIRMED") {
      direction = "SELL";
    }

    /* -----------------------------------------------------
       Signal ID
       Liquid Chart can use this to avoid duplicates.
    ----------------------------------------------------- */

    const currentPrice =
      Number(
        confirmation.currentPrice || 0
      );

    const generatedAt =
      data.generatedAt ||
      new Date().toISOString();

    const signalId =
      direction
        ? `${direction}_${generatedAt}_${currentPrice}`
        : `WAITING_${generatedAt}`;

    /* -----------------------------------------------------
       Build normalized signal
    ----------------------------------------------------- */

    const signal = {
      success: true,

      executable:
        direction !== null,

      signalId,

      instrument:
        data.instrument || "XAUUSD",

      direction,

      status,

      generatedAt,

      price:
        currentPrice,

      entry:
        Number(levels.entry || 0),

      stopLoss:
        Number(levels.stopLoss || 0),

      tp1:
        Number(levels.tp1 || 0),

      tp2:
        Number(levels.tp2 || 0),

      tp3:
        Number(levels.tp3 || 0),

      mtf:
        data.MTF || {},

      confirmation,

      levels,

      fetchedAt:
        new Date().toISOString()
    };

    /* -----------------------------------------------------
       Save last signal
    ----------------------------------------------------- */

    lastSignal = signal;

    /* -----------------------------------------------------
       Return normalized signal
    ----------------------------------------------------- */

    return res.json(signal);

  } catch (error) {

    console.error(
      "SIGNAL ERROR:",
      error
    );

    return res.status(500).json({
      success: false,

      executable: false,

      error:
        error.message,

      sourceBot:
        SOURCE_BOT_URL,

      time:
        new Date().toISOString()
    });
  }
});

/* =========================================================
   LAST CACHED SIGNAL
========================================================= */

app.get("/last-signal", (req, res) => {

  res.json({
    success: true,

    signal:
      lastSignal,

    lastFetch
  });

});

/* =========================================================
   ACKNOWLEDGEMENT
   Liquid Chart can tell the bridge that it executed.
========================================================= */

app.post("/ack", (req, res) => {

  const {
    signalId,
    direction,
    orderId,
    result
  } = req.body || {};

  console.log(
    "EXECUTION ACK:",
    {
      signalId,
      direction,
      orderId,
      result
    }
  );

  res.json({
    success: true,

    acknowledged: true,

    signalId:
      signalId || null,

    time:
      new Date().toISOString()
  });

});

/* =========================================================
   SERVER
========================================================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `XAU Execution Bridge running on port ${PORT}`
    );

  }
);
