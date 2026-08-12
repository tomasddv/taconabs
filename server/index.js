import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import multer from "multer";
import { config } from "./config.js";
import { downloadDriveFile, uploadFileToDrive } from "./drive.js";
import { parseVentaDiaria, summarizeVenta } from "./ventaParser.js";
import { buildObjectivePerformance, distributeObjective, loadAuxiliaryRules, loadComboObjective, loadObjectiveWorkbook, objectiveKeyForQuery } from "./objectives.js";
import { buildMonthlyClosure, listMonthlyClosures, saveMonthlyClosure } from "./monthlyClosures.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const upload = multer({ dest: path.join(rootDir, "uploads") });
const app = express();
let objectiveCache = null;
let comboObjectiveCache = undefined;
let auxiliaryRulesCache = null;
let historicalCache = null;
const dashboardCache = new Map();
const MAX_DASHBOARD_CACHE_ENTRIES = 12;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, source: "ventadiaria.txt" });
});

app.get("/api/dashboard", async (req, res, next) => {
  try {
    const { dashboard } = await getDashboardPayload(req.query);
    res.json(dashboard);
  } catch (error) {
    next(error);
  }
});

app.get("/api/monthly-closures", async (_req, res, next) => {
  try {
    res.json({
      closes: await listMonthlyClosures({
        rootDir,
        folderId: config.driveFolderId
      })
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/monthly-closures", async (req, res, next) => {
  try {
    const month = String(req.body?.month || "").trim();
    const { dashboard, parsed } = await getDashboardPayload(month ? { mes: month } : {}, { includeParsed: true });
    const closure = buildMonthlyClosure({
      dashboard,
      rows: parsed.rows,
      month,
      sourceFile: "ventadiaria.txt"
    });
    const saved = await saveMonthlyClosure({
      closure,
      rootDir,
      folderId: config.driveFolderId
    });
    dashboardCache.clear();
    res.json({ ok: true, closure, saved });
  } catch (error) {
    next(error);
  }
});

app.post("/api/monthly-focus", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "Debe subir un archivo Excel." });
      return;
    }

    const uploaded = await uploadFileToDrive({
      filePath: req.file.path,
      fileName: req.body.month ? `focos-objetivos-${req.body.month}.xlsx` : req.file.originalname,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      folderId: config.driveFolderId
    });

    res.json({
      ok: true,
      driveFile: uploaded,
      summary: {
        originalName: req.file.originalname,
        size: req.file.size,
        month: req.body.month || null
      }
    });
  } catch (error) {
    next(error);
  }
});

const distDir = path.join(rootDir, "dist");

app.use(express.static(distDir));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    next();
    return;
  }
  res.sendFile(path.join(distDir, "index.html"));
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: error.message || "Error interno" });
});

async function getObjective() {
  if (!objectiveCache) {
    objectiveCache = await loadObjectiveWorkbook({
      localPath: config.objetivoLocalPath,
      driveFileId: config.objetivoFileId,
      rootDir
    });
  }
  return objectiveCache;
}

async function getComboObjective() {
  if (comboObjectiveCache === undefined) {
    comboObjectiveCache = await loadComboObjective({
      localPath: config.seguimientoLocalPath,
      fallback: config.comboObjectiveFallback
    });
  }
  return comboObjectiveCache;
}

async function getAuxiliaryRules() {
  if (!auxiliaryRulesCache) {
    auxiliaryRulesCache = await loadAuxiliaryRules({ driveFileId: config.auxiliaresFileId });
  }
  return auxiliaryRulesCache;
}

function dashboardCacheKey(query = {}) {
  return JSON.stringify(Object.fromEntries(Object.entries(query).sort(([a], [b]) => a.localeCompare(b))));
}

async function getDashboardPayload(query = {}, options = {}) {
  const key = dashboardCacheKey(query);
  const cached = dashboardCache.get(key);
  if (!options.includeParsed && cached && Date.now() - cached.createdAt < config.dashboardCacheMs) {
    return { dashboard: cached.dashboard };
  }

  const buffer = await downloadDriveFile(config.ventaDiariaFileId);
  const parsed = parseVentaDiaria(buffer);
  const objective = await getObjective();
  const comboObjective = await getComboObjective();
  const auxiliaryRules = await getAuxiliaryRules();
  const historicalRows = await getHistoricalRows(parsed.rows);
  const dashboard = summarizeVenta(parsed, query, {
    distributeObjective: ({ currentRows, query: currentQuery }) =>
      distributeObjective({
        objective,
        objectiveKey: objectiveKeyForQuery(currentQuery),
        historicalRows,
        currentRows,
        auxiliaryRules
      }),
    buildObjectivePerformance: ({ rows, dateSet }) => buildObjectivePerformance({ objective, rows, dateSet, auxiliaryRules }),
    comboObjective
  });
  if (!options.includeParsed) {
    if (dashboardCache.size >= MAX_DASHBOARD_CACHE_ENTRIES) {
      dashboardCache.delete(dashboardCache.keys().next().value);
    }
    dashboardCache.set(key, { createdAt: Date.now(), dashboard });
  }
  return options.includeParsed ? { dashboard, parsed } : { dashboard };
}

async function getHistoricalRows(currentRows) {
  if (!config.historicalVentaFileIds.length) {
    return currentRows || [];
  }
  if (!historicalCache) {
    const parsedFiles = [];
    for (const fileId of config.historicalVentaFileIds) {
      const buffer = await downloadDriveFile(fileId);
      parsedFiles.push(...parseVentaDiaria(buffer).rows);
    }
    historicalCache = parsedFiles;
  }
  return [...historicalCache, ...(currentRows || [])];
}

app.listen(config.port, () => {
  console.log(`API lista en http://127.0.0.1:${config.port}`);
});
