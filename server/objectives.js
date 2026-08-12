import fs from "node:fs/promises";
import path from "node:path";
import XLSX from "xlsx";
import { downloadDriveFile } from "./drive.js";

const LOCAL_DISTRIBUTOR = "DISTRIBUIDORA DEL VALLE S.A.";
const OBJECTIVE_SHEET = "OBJETIVOS AGOSTO";
const OBJECTIVE_COLUMNS = [
  "BD TOTAL NABS",
  "BD GATORADE",
  "BD CSDs MS",
  "BD TOP",
  "BD ENERGIA",
  "BD AGUAS",
  "BD MARKETPLACE PURO",
  "CCC NABS",
  "CCC BLACK",
  "CCC H2Oh",
  "CONVIVENCIA 1,5L y 2L",
  "BD SS"
];

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function numberValue(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;
  const parsed = Number(String(value).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function rowsFromWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = workbook.Sheets[OBJECTIVE_SHEET] || workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
}

function parseSellerHlObjectives(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: null });
  const headerIndex = rows.findIndex((row) => normalizeText(row[0]) === "SELECCION" && normalizeText(row[1]) === "DESCRIPCION");
  const objectiveRow = rows.find((row) => {
    const description = normalizeText(row[1]);
    return description.includes("7-UP") || description.includes("7 UP") || description.includes("7UP");
  });
  if (headerIndex === -1 || !objectiveRow) return null;

  const bySeller = [];
  for (let column = 2; column < rows[headerIndex].length; column += 1) {
    const label = rows[headerIndex][column];
    const value = numberValue(objectiveRow[column]);
    const match = String(label || "").match(/^\d+-(.+)$/);
    if (!match || !value) continue;
    const seller = normalizeText(match[1]) === "SIN VENDEDOR ASIGNADO" ? "Sin dato" : normalizeText(match[1]);
    bySeller.push({ promotor: seller, objetivo: value });
  }
  const total = bySeller.reduce((sum, row) => sum + row.objetivo, 0);
  return {
    source: "OBJETIVO.xlsx",
    product: objectiveRow[1],
    total,
    bySeller
  };
}

export async function loadObjectiveWorkbook({ localPath, driveFileId, rootDir }) {
  let buffer = null;
  let source = null;
  let sellerHlObjectives = null;
  if (driveFileId) {
    try {
      const driveBuffer = await downloadDriveFile(driveFileId);
      sellerHlObjectives = parseSellerHlObjectives(driveBuffer);
    } catch {
      sellerHlObjectives = null;
    }
  }
  const resolvedLocalPath = localPath ? path.resolve(rootDir, localPath) : null;
  if (resolvedLocalPath) {
    try {
      buffer = await fs.readFile(resolvedLocalPath);
      source = path.basename(resolvedLocalPath);
    } catch {
      buffer = null;
    }
  }
  if (!buffer && driveFileId) {
    buffer = await downloadDriveFile(driveFileId);
    source = "OBJETIVO.xlsx";
  }
  if (!buffer) return null;

  const rows = rowsFromWorkbook(buffer);
  const headerIndex = rows.findIndex((row) => row.some((cell) => normalizeText(cell) === "DISTRIBUIDOR"));
  if (headerIndex === -1) return null;
  const headers = rows[headerIndex].map((cell) => String(cell || "").trim());
  const distributorIndex = headers.findIndex((header) => normalizeText(header) === "DISTRIBUIDOR");
  const localRow = rows.slice(headerIndex + 1).find((row) => normalizeText(row[distributorIndex]) === normalizeText(LOCAL_DISTRIBUTOR));
  if (!localRow) return null;

  const values = {};
  for (const column of OBJECTIVE_COLUMNS) {
    const index = headers.findIndex((header) => normalizeText(header) === normalizeText(column));
    values[column] = index === -1 ? 0 : numberValue(localRow[index]);
  }

  return {
    source,
    distributor: LOCAL_DISTRIBUTOR,
    region: localRow[headers.findIndex((header) => normalizeText(header) === "REGION")] || null,
    leader: localRow[headers.findIndex((header) => normalizeText(header) === "LIDER")] || null,
    sellerHlObjectives,
    values
  };
}

export async function loadComboObjective({ localPath }) {
  if (!localPath) return null;
  try {
    const buffer = await fs.readFile(path.resolve(localPath));
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheet = workbook.Sheets["Tab.gral"];
    if (!sheet) return null;
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    const row = rows.find((item) => normalizeText(item[1]) === "COBERTURA COMBOS FOCOS");
    const objective = numberValue(row?.[3]);
    return objective || null;
  } catch {
    return null;
  }
}

function isEnergy(row) {
  return ["RED BULL", "ROCKSTAR"].includes(row.marca);
}

function isCsd(row) {
  return ["PEPSI", "PEPSI BLACK", "7 UP", "7 UP FREE", "MIRINDA", "PASO DE LOS TOROS", "H2OH"].includes(row.marca);
}

function isTop(row) {
  const text = normalizeText(`${row.marca} ${row.productoEstadistico} ${row.foco}`);
  return text.includes("BLACK") || text.includes("FREE") || text.includes("NON SUGAR") || text.includes("TOP");
}

function rowMatchesObjective(row, objectiveKey) {
  if (objectiveKey === "BD GATORADE") return row.marca === "GATORADE";
  if (objectiveKey === "BD AGUAS") return row.negocio === "Aguas";
  if (objectiveKey === "BD MARKETPLACE PURO") return row.negocio === "Marketplace";
  if (objectiveKey === "BD ENERGIA") return isEnergy(row);
  if (objectiveKey === "BD CSDs MS") return isCsd(row);
  if (objectiveKey === "BD TOP") return isTop(row);
  return row.negocio !== "Marketplace";
}

function isBlack(row) {
  const text = normalizeText(`${row.marca} ${row.productoEstadistico} ${row.articulo}`);
  return text.includes("BLACK") || text.includes("FREE") || text.includes("NON SUGAR");
}

function isH2oh(row) {
  return normalizeText(`${row.marca} ${row.productoEstadistico}`).includes("H2OH");
}

function isConvivencia(row) {
  const text = normalizeText(`${row.calibre} ${row.articulo} ${row.productoEstadistico}`);
  return text.includes("1500") || text.includes("1.5") || text.includes("1,5") || text.includes("2000") || text.includes("2L");
}

function brandDistributionCount(rows) {
  return new Set(rows.map((row) => `${row.clienteCodigo || row.cliente}|${row.articuloCodigo || row.articulo}`).filter(Boolean)).size;
}

function cccCount(rows) {
  return new Set(rows.map((row) => row.clienteCodigo || row.cliente).filter(Boolean)).size;
}

const PERFORMANCE_DEFINITIONS = [
  { key: "BD TOTAL NABS", label: "BD Total NABS", tipo: "BD", matcher: (row) => row.negocio !== "Marketplace", calc: brandDistributionCount },
  { key: "BD GATORADE", label: "BD Gatorade", tipo: "BD", matcher: (row) => row.marca === "GATORADE", calc: brandDistributionCount },
  { key: "BD CSDs MS", label: "BD CSDs MS", tipo: "BD", matcher: isCsd, calc: brandDistributionCount },
  { key: "BD TOP", label: "BD TOP", tipo: "BD", matcher: isTop, calc: brandDistributionCount },
  { key: "BD ENERGIA", label: "BD Energia", tipo: "BD", matcher: isEnergy, calc: brandDistributionCount },
  { key: "BD AGUAS", label: "BD Aguas", tipo: "BD", matcher: (row) => row.negocio === "Aguas", calc: brandDistributionCount },
  { key: "BD MARKETPLACE PURO", label: "BD Marketplace puro", tipo: "BD", matcher: (row) => row.negocio === "Marketplace", calc: brandDistributionCount },
  { key: "CCC NABS", label: "CCC NABS", tipo: "CCC", matcher: (row) => row.negocio !== "Marketplace", calc: cccCount },
  { key: "CCC BLACK", label: "CCC Black", tipo: "CCC", matcher: isBlack, calc: cccCount },
  { key: "CCC H2Oh", label: "CCC H2Oh", tipo: "CCC", matcher: isH2oh, calc: cccCount },
  { key: "CONVIVENCIA 1,5L y 2L", label: "Convivencia 1,5L y 2L", tipo: "CCC", matcher: isConvivencia, calc: cccCount },
  { key: "BD SS", label: "BD SS", tipo: "BD", matcher: isBlack, calc: brandDistributionCount }
];

export function objectiveKeyForQuery(query = {}) {
  const brand = normalizeText(query.marca);
  const business = normalizeText(query.negocio);
  const group = normalizeText(query.grupoProducto);
  if (brand === "GATORADE" || group.includes("GATORADE")) return "BD GATORADE";
  if (brand === "RED BULL" || brand === "ROCKSTAR" || business.includes("ENERG")) return "BD ENERGIA";
  if (business === "AGUAS" || ["NESTLE PUREZA VITAL", "GLACIAR", "ECO DE LOS ANDES"].includes(brand)) return "BD AGUAS";
  if (business === "MARKETPLACE") return "BD MARKETPLACE PURO";
  if (brand.includes("BLACK") || brand.includes("FREE") || group.includes("NON SUGAR") || group.includes("TOP")) return "BD TOP";
  if (brand && ["PEPSI", "7 UP", "MIRINDA", "PASO DE LOS TOROS", "H2OH"].some((item) => brand.includes(item))) return "BD CSDs MS";
  return "BD TOTAL NABS";
}

export function buildObjectivePerformance({ objective, rows, dateSet }) {
  if (!objective?.values) return [];
  const elapsedDays = Math.max(dateSet?.size || 0, 1);
  const assumedBusinessDays = 26;
  return PERFORMANCE_DEFINITIONS.map((definition) => {
    const objectiveValue = numberValue(objective.values[definition.key]);
    const matchedRows = (rows || []).filter(definition.matcher);
    const real = definition.calc(matchedRows);
    const projected = (real / elapsedDays) * assumedBusinessDays;
    return {
      label: definition.label,
      objetivo: objectiveValue,
      real,
      avance: objectiveValue ? real / objectiveValue : null,
      faltante: Math.max(objectiveValue - real, 0),
      tendencia: projected,
      tendenciaAvance: objectiveValue ? projected / objectiveValue : null,
      tipo: definition.tipo,
      fuente: objective.source
    };
  }).filter((row) => row.objetivo > 0);
}

export function distributeObjective({ objective, objectiveKey, historicalRows, currentRows }) {
  if (!objective?.values) return null;
  if (objectiveKey === "BD TOTAL NABS" && objective.sellerHlObjectives?.bySeller?.length) {
    const currentBySeller = new Map();
    for (const row of currentRows || []) {
      const seller = row.vendedor || "Sin dato";
      currentBySeller.set(seller, (currentBySeller.get(seller) || 0) + Number(row.hl || 0));
    }
    const bySeller = objective.sellerHlObjectives.bySeller
      .map((row) => {
        const real = currentBySeller.get(row.promotor) || 0;
        return {
          label: row.promotor,
          promotor: row.promotor,
          objetivo: row.objetivo,
          real,
          faltante: Math.max(row.objetivo - real, 0),
          avance: row.objetivo ? real / row.objetivo : null,
          pesoHistorico: objective.sellerHlObjectives.total ? row.objetivo / objective.sellerHlObjectives.total : 0,
          baseHl3m: null
        };
      })
      .sort((a, b) => b.objetivo - a.objetivo);
    return {
      source: objective.sellerHlObjectives.source,
      distributor: objective.distributor,
      region: objective.region,
      leader: objective.leader,
      objectiveKey,
      totalObjective: objective.sellerHlObjectives.total,
      brandDistributionObjective: numberValue(objective.values[objectiveKey]) || null,
      sellerObjectiveTotal: objective.sellerHlObjectives.total,
      totalBasisHl: null,
      basis: `Objetivo HL desde fila ${objective.sellerHlObjectives.product || "7-UP"} de OBJETIVO.xlsx en Drive`,
      metric: "HL",
      bySeller
    };
  }
  const totalObjective = numberValue(objective.values[objectiveKey]);
  const basisRows = (historicalRows || []).filter((row) => rowMatchesObjective(row, objectiveKey));
  const sellerBasis = new Map();
  for (const row of basisRows) {
    const seller = row.vendedor || "Sin dato";
    sellerBasis.set(seller, (sellerBasis.get(seller) || 0) + Number(row.hl || 0));
  }

  const currentBySeller = new Map();
  for (const row of currentRows || []) {
    const seller = row.vendedor || "Sin dato";
    const current = currentBySeller.get(seller) || { seller, clientesSet: new Set(), hl: 0 };
    current.clientesSet.add(row.clienteCodigo || row.cliente);
    current.hl += Number(row.hl || 0);
    currentBySeller.set(seller, current);
  }

  const sellers = [...new Set([...sellerBasis.keys(), ...currentBySeller.keys()])].filter(Boolean);
  const totalBasis = [...sellerBasis.values()].reduce((total, value) => total + value, 0);
  const bySeller = sellers
    .map((seller) => {
      const basisHl = sellerBasis.get(seller) || 0;
      const share = totalBasis ? basisHl / totalBasis : 0;
      const objetivo = totalObjective * share;
      const current = currentBySeller.get(seller);
      const real = current?.clientesSet.size || 0;
      return {
        label: seller,
        promotor: seller,
        objetivo,
        real,
        faltante: Math.max(objetivo - real, 0),
        avance: objetivo ? real / objetivo : null,
        pesoHistorico: share,
        baseHl3m: basisHl
      };
    })
    .sort((a, b) => b.objetivo - a.objetivo);

  return {
    source: objective.source,
    distributor: objective.distributor,
    region: objective.region,
    leader: objective.leader,
    objectiveKey,
    totalObjective,
    totalBasisHl: totalBasis,
    basis: "HL acumulado de junio, julio y venta diaria actual disponible",
    metric: "CCC",
    bySeller
  };
}
