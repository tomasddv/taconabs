import fs from "node:fs/promises";
import path from "node:path";
import { downloadDriveText, listDriveFiles, uploadTextToDrive } from "./drive.js";

const CLOSE_PREFIX = "cierre-";

function limitRows(rows, limit = 20) {
  return (rows || []).slice(0, limit);
}

function rowsByMonth(rows, month) {
  if (!month) return rows || [];
  return (rows || []).filter((row) => row.fechaISO?.startsWith(month));
}

function latestMonth(rows) {
  return [...new Set((rows || []).map((row) => row.fechaISO?.slice(0, 7)).filter(Boolean))].sort().at(-1) || "";
}

export function buildMonthlyClosure({ dashboard, rows, month, sourceFile = "ventadiaria.txt" }) {
  const closeMonth = month || latestMonth(rows);
  const monthRows = rowsByMonth(rows, closeMonth);
  return {
    schemaVersion: 1,
    month: closeMonth,
    closedAt: new Date().toISOString(),
    sourceFile,
    generatedRows: monthRows.length,
    totals: dashboard.totals,
    executive: dashboard.executive,
    productScope: dashboard.productScope,
    quality: {
      loadedRows: dashboard.quality?.loadedRows || 0,
      duplicates: dashboard.quality?.duplicates || 0,
      missingHeaders: dashboard.quality?.missingHeaders || []
    },
    tables: {
      bySeller: limitRows(dashboard.bySeller, 40),
      bySellerCcc: limitRows(dashboard.bySellerCcc, 40),
      byBusiness: limitRows(dashboard.byBusiness, 20),
      byBrand: limitRows(dashboard.byBrand, 40),
      byCaliber: limitRows(dashboard.byCaliber, 40),
      objectivePerformance: limitRows(dashboard.objectivePerformance, 80),
      objectiveDistribution: limitRows(dashboard.objectiveDistribution?.bySeller, 50),
      brandByPromotorNegocio: limitRows(dashboard.brandDistribution?.byPromotorNegocio, 80),
      combosBySeller: limitRows(dashboard.combosFocus?.bySeller, 40),
      combosByComboCcc: limitRows(dashboard.combosFocus?.byComboCcc, 50),
      marketplaceBySeller: limitRows(dashboard.marketplace?.bySeller, 40),
      coverageUng: limitRows(dashboard.coverage?.cccTotalUng, 40),
      coverageAguas: limitRows(dashboard.coverage?.cccAguas, 40),
      coverageMarketplace: limitRows(dashboard.coverage?.cccMarketplace, 40)
    }
  };
}

export async function saveMonthlyClosure({ closure, rootDir, folderId }) {
  const fileName = `${CLOSE_PREFIX}${closure.month}.json`;
  const text = JSON.stringify(closure, null, 2);
  const localDir = path.join(rootDir, "uploads", "cierres");
  await fs.mkdir(localDir, { recursive: true });
  const localPath = path.join(localDir, fileName);
  await fs.writeFile(localPath, text, "utf8");

  let driveFile = null;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    driveFile = await uploadTextToDrive({
      text,
      fileName,
      mimeType: "application/json",
      folderId
    });
  }

  return {
    fileName,
    localPath,
    driveFile
  };
}

export async function listMonthlyClosures({ rootDir, folderId }) {
  const closures = [];
  const localDir = path.join(rootDir, "uploads", "cierres");
  try {
    const files = await fs.readdir(localDir);
    for (const file of files.filter((name) => name.startsWith(CLOSE_PREFIX) && name.endsWith(".json"))) {
      const text = await fs.readFile(path.join(localDir, file), "utf8");
      closures.push({ ...JSON.parse(text), storage: "local", fileName: file });
    }
  } catch {
    // Local monthly closes are optional.
  }

  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      const files = await listDriveFiles({ folderId, namePrefix: CLOSE_PREFIX });
      for (const file of files.filter((item) => item.name.endsWith(".json"))) {
        const text = await downloadDriveText(file.id);
        closures.push({
          ...JSON.parse(text),
          storage: "drive",
          fileName: file.name,
          driveFile: file
        });
      }
    } catch {
      // Drive closes are optional when credentials are not configured.
    }
  }

  const byMonth = new Map();
  for (const closure of closures) {
    if (!closure.month) continue;
    const current = byMonth.get(closure.month);
    if (!current || current.storage !== "drive") byMonth.set(closure.month, closure);
  }
  return [...byMonth.values()].sort((a, b) => String(b.month).localeCompare(String(a.month)));
}
