import iconv from "iconv-lite";
import Papa from "papaparse";

const REQUIRED_HEADERS = [
  "Descripción Período",
  "Cod. Cliente",
  "Descripción Vendedor",
  "Marca",
  "Calibre",
  "Unidad de Negocio",
  "Cantidades Totales",
  "Importes Netos",
  "Importes Finales",
  "Cantidad de Facturas"
];

const FIELD_ALIASES = {
  fecha: ["Descripción Período"],
  clienteCodigo: ["Cod. Cliente"],
  cliente: ["Clientes", "Descripción"],
  rutaCodigo: ["Ruta"],
  ruta: ["Descripción__2"],
  ramo: ["Descripción Ramo"],
  vendedorCodigo: ["Vendedor"],
  vendedor: ["Descripción Vendedor"],
  articuloCodigo: ["Código"],
  articulo: ["Artículos por Precio"],
  marcaCodigo: ["Marca"],
  calibreCodigo: ["Calibre"],
  divisionCodigo: ["División"],
  productoEstadisticoCodigo: ["Producto Estadístico"],
  unidadNegocioCodigo: ["Unidad de Negocio"],
  precio: ["Precio"],
  bonificacion: ["Bonific"],
  precioNeto: ["Pr Neto"],
  hl: ["Cantidades Totales"],
  importeNeto: ["Importes Netos"],
  importeFinal: ["Importes Finales"],
  facturas: ["Cantidad de Facturas"],
  combos: ["Cantidades en Combos"]
};

function dedupeHeaders(headers) {
  const counts = new Map();
  return headers.map((header) => {
    const clean = String(header || "").trim();
    const count = counts.get(clean) || 0;
    counts.set(clean, count + 1);
    return count === 0 ? clean : `${clean}__${count + 1}`;
  });
}

function numberFromAr(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;
  const normalized = String(value).trim().replace(/\./g, "").replace(",", ".").replace("%", "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pick(row, candidates) {
  for (const candidate of candidates) {
    if (row[candidate] !== undefined) return row[candidate];
  }
  return "";
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function classifyBusiness(row) {
  const text = normalizeText(
    `${row.marca} ${row.calibre} ${row.division} ${row.productoEstadistico} ${row.unidadNegocio}`
  );
  if (text.includes("MARKETPLACE") || text.includes("MKTPLACE")) return "Marketplace";
  if (text.includes("RED BULL")) return "Red Bull";
  if (text.includes("AGUA") || text.includes("GLACIAR") || text.includes("NESTLE") || text.includes("ECO DE LOS ANDES")) {
    return "Aguas";
  }
  if (text.includes("VINO") || text.includes("ESPUMANTE")) return "Vinos";
  if (text.includes("SIDRA")) return "Sidras";
  if (text.includes("GIN")) return "Gin";
  if (text.includes("NON SUGAR") || text.includes("SIN AZUCAR") || text.includes("BLACK") || text.includes("FREE")) {
    return "TOP + Non Sugar";
  }
  if (text.includes("GATORADE") || text.includes("PEPSI") || text.includes("7 UP") || text.includes("MIRINDA") || text.includes("H2OH")) {
    return "UNG";
  }
  return row.unidadNegocio || row.division || "Otros";
}

function classifyFocus(row) {
  const text = normalizeText(`${row.marca} ${row.calibre} ${row.productoEstadistico}`);
  if (text.includes("RED BULL")) return "Red Bull";
  if (text.includes("GATORADE")) return "Gatorade";
  if (text.includes("BLACK") || text.includes("FREE") || text.includes("NON SUGAR")) return "Non Sugar";
  if (text.includes("AGUA") || text.includes("H2OH") || text.includes("GLACIAR") || text.includes("NESTLE")) return "Aguas";
  if (text.includes("PEPSI") || text.includes("7 UP") || text.includes("MIRINDA")) return "Familiares";
  return "Otros";
}

function parseDateKey(value) {
  const match = String(value || "").match(/(\d{1,2})-([a-zA-Z]{3})-(\d{2})/);
  if (!match) return null;
  const months = { ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11 };
  const day = Number(match[1]);
  const month = months[match[2].toLowerCase()];
  const year = 2000 + Number(match[3]);
  if (!Number.isFinite(day) || month === undefined) return null;
  return new Date(Date.UTC(year, month, day));
}

export function parseVentaDiaria(buffer) {
  const text = iconv.decode(buffer, "win1252");
  const parsed = Papa.parse(text, {
    delimiter: "\t",
    header: false,
    skipEmptyLines: true
  });

  const [rawHeaders, ...rawRows] = parsed.data;
  const headers = dedupeHeaders(rawHeaders || []);

  const rows = rawRows
    .filter((row) => row.length > 5)
    .map((row, index) => {
      const source = Object.fromEntries(headers.map((header, columnIndex) => [header, row[columnIndex] ?? ""]));
      const parsedRow = {
        id: index + 1,
        fecha: pick(source, FIELD_ALIASES.fecha),
        clienteCodigo: pick(source, FIELD_ALIASES.clienteCodigo),
        cliente: pick(source, FIELD_ALIASES.cliente),
        rutaCodigo: pick(source, FIELD_ALIASES.rutaCodigo),
        ruta: pick(source, FIELD_ALIASES.ruta),
        ramo: pick(source, FIELD_ALIASES.ramo),
        vendedorCodigo: pick(source, FIELD_ALIASES.vendedorCodigo),
        vendedor: pick(source, FIELD_ALIASES.vendedor),
        articuloCodigo: pick(source, FIELD_ALIASES.articuloCodigo),
        articulo: pick(source, FIELD_ALIASES.articulo),
        marcaCodigo: pick(source, FIELD_ALIASES.marcaCodigo),
        marca: source["Descripción__4"] || "",
        calibreCodigo: pick(source, FIELD_ALIASES.calibreCodigo),
        calibre: source["Descripción__5"] || "",
        divisionCodigo: pick(source, FIELD_ALIASES.divisionCodigo),
        division: source["Descripción__6"] || "",
        productoEstadisticoCodigo: pick(source, FIELD_ALIASES.productoEstadisticoCodigo),
        productoEstadistico: source["Descripción__7"] || "",
        unidadNegocioCodigo: pick(source, FIELD_ALIASES.unidadNegocioCodigo),
        unidadNegocio: source["Descripción__9"] || "",
        precio: numberFromAr(pick(source, FIELD_ALIASES.precio)),
        bonificacion: numberFromAr(pick(source, FIELD_ALIASES.bonificacion)),
        precioNeto: numberFromAr(pick(source, FIELD_ALIASES.precioNeto)),
        hl: numberFromAr(pick(source, FIELD_ALIASES.hl)),
        importeNeto: numberFromAr(pick(source, FIELD_ALIASES.importeNeto)),
        importeFinal: numberFromAr(pick(source, FIELD_ALIASES.importeFinal)),
        facturas: numberFromAr(pick(source, FIELD_ALIASES.facturas)),
        combos: numberFromAr(pick(source, FIELD_ALIASES.combos))
      };
      parsedRow.negocio = classifyBusiness(parsedRow);
      parsedRow.foco = classifyFocus(parsedRow);
      parsedRow.fechaISO = parseDateKey(parsedRow.fecha)?.toISOString().slice(0, 10) || "";
      return parsedRow;
    });

  return {
    headers,
    rows,
    headerIssues: REQUIRED_HEADERS.filter((header) => !headers.includes(header))
  };
}

function distinctCount(rows, key) {
  return new Set(rows.map((row) => row[key]).filter(Boolean)).size;
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + Number(row[key] || 0), 0);
}

function groupBy(rows, key, sortMetric = "hl") {
  const grouped = new Map();
  for (const row of rows) {
    const label = row[key] || "Sin dato";
    const current = grouped.get(label) || {
      label,
      rows: 0,
      clientesSet: new Set(),
      skuSet: new Set(),
      hl: 0,
      importeNeto: 0,
      importeFinal: 0,
      facturas: 0,
      combos: 0
    };
    current.rows += 1;
    current.clientesSet.add(row.clienteCodigo || row.cliente);
    current.skuSet.add(row.articuloCodigo || row.articulo);
    current.hl += row.hl;
    current.importeNeto += row.importeNeto;
    current.importeFinal += row.importeFinal;
    current.facturas += row.facturas;
    current.combos += row.combos;
    grouped.set(label, current);
  }
  return [...grouped.values()]
    .map((item) => ({
      label: item.label,
      rows: item.rows,
      clientes: item.clientesSet.size,
      skus: item.skuSet.size,
      hl: item.hl,
      importeNeto: item.importeNeto,
      importeFinal: item.importeFinal,
      facturas: item.facturas,
      combos: item.combos
    }))
    .sort((a, b) => (b[sortMetric] || 0) - (a[sortMetric] || 0));
}

function makeExecutive(totals, dates, objective = null) {
  const sortedDates = [...dates].filter(Boolean).sort();
  const elapsedBusinessDays = sortedDates.length;
  const assumedBusinessDays = 26;
  const remainingBusinessDays = Math.max(assumedBusinessDays - elapsedBusinessDays, 0);
  const dailyAverage = elapsedBusinessDays ? totals.hl / elapsedBusinessDays : 0;
  const projectedClose = dailyAverage * assumedBusinessDays;
  const progress = objective ? totals.hl / objective : null;
  const missing = objective ? Math.max(objective - totals.hl, 0) : null;
  const requiredDaily = missing !== null && remainingBusinessDays ? missing / remainingBusinessDays : null;
  const projectedProgress = objective ? projectedClose / objective : null;
  let status = "Sin objetivo";
  if (projectedProgress !== null) {
    if (projectedProgress >= 1) status = "Arriba";
    else if (projectedProgress >= 0.9) status = "En riesgo";
    else status = "Debajo";
  }
  return {
    objective,
    progress,
    projectedClose,
    projectedProgress,
    missing,
    requiredDaily,
    elapsedBusinessDays,
    remainingBusinessDays,
    assumedBusinessDays,
    status
  };
}

function dataQuality(rows, headers, headerIssues) {
  const requiredRowFields = ["fecha", "clienteCodigo", "cliente", "vendedor", "marca", "calibre", "hl"];
  const missingValues = requiredRowFields.map((field) => ({
    field,
    rows: rows.filter((row) => row[field] === "" || row[field] === null || row[field] === undefined).length
  }));
  const duplicateKey = new Set();
  let duplicates = 0;
  for (const row of rows) {
    const key = [row.fecha, row.clienteCodigo, row.articuloCodigo, row.vendedorCodigo, row.hl, row.importeNeto].join("|");
    if (duplicateKey.has(key)) duplicates += 1;
    duplicateKey.add(key);
  }
  return {
    lastUpdated: new Date().toISOString(),
    sourceFile: "ventadiaria.txt",
    ignoredFiles: ["ventadiaria bultos.txt"],
    loadedRows: rows.length,
    loadedColumns: headers.length,
    missingHeaders: headerIssues,
    missingValues,
    duplicates,
    unmappedSellers: groupBy(rows.filter((row) => !row.vendedor || row.vendedor === "Sin Vendedor Asignado"), "vendedor"),
    formatAlerts: headerIssues.length ? ["Cambios detectados en columnas requeridas."] : []
  };
}

function filterOptions(rows) {
  const optionFor = (key) => [...new Set(rows.map((row) => row[key]).filter(Boolean))].sort();
  return {
    mes: [...new Set(rows.map((row) => row.fechaISO.slice(0, 7)).filter(Boolean))].sort(),
    fecha: optionFor("fecha"),
    promotor: optionFor("vendedor"),
    supervisor: [],
    negocio: optionFor("negocio"),
    grupoProducto: optionFor("productoEstadistico"),
    marca: optionFor("marca"),
    calibre: optionFor("calibre"),
    canal: optionFor("ramo"),
    cliente: optionFor("cliente")
  };
}

export function applyFilters(rows, query = {}) {
  const filterMap = {
    mes: (row, value) => row.fechaISO.startsWith(value),
    fecha: (row, value) => row.fecha === value,
    promotor: (row, value) => row.vendedor === value,
    negocio: (row, value) => row.negocio === value,
    grupoProducto: (row, value) => row.productoEstadistico === value,
    marca: (row, value) => row.marca === value,
    calibre: (row, value) => row.calibre === value,
    canal: (row, value) => row.ramo === value,
    cliente: (row, value) => row.cliente === value
  };
  return rows.filter((row) =>
    Object.entries(filterMap).every(([key, predicate]) => {
      const value = query[key];
      if (!value) return true;
      return predicate(row, value);
    })
  );
}

export function summarizeVenta(parsed, query = {}) {
  const allRows = parsed.rows || parsed;
  const rows = applyFilters(allRows, query);
  const dateSet = new Set(rows.map((row) => row.fechaISO).filter(Boolean));
  const totals = {
    hl: sum(rows, "hl"),
    importeNeto: sum(rows, "importeNeto"),
    importeFinal: sum(rows, "importeFinal"),
    facturas: sum(rows, "facturas"),
    clientes: distinctCount(rows, "clienteCodigo"),
    diasVenta: dateSet.size,
    skus: distinctCount(rows, "articuloCodigo")
  };

  const bySeller = groupBy(rows, "vendedor");
  const bySellerCcc = [...bySeller].sort((a, b) => b.clientes - a.clientes);
  const byBusiness = groupBy(rows, "negocio");
  const byFocus = groupBy(rows, "foco");
  const byProduct = groupBy(rows, "productoEstadistico");
  const byMarketplace = rows.filter((row) => row.negocio === "Marketplace");
  const byCombo = rows.filter((row) => row.combos > 0);

  return {
    generatedAt: new Date().toISOString(),
    source: "ventadiaria.txt",
    ignoredSources: ["ventadiaria bultos.txt"],
    totalRows: rows.length,
    totals,
    executive: makeExecutive(totals, dateSet),
    byDay: groupBy(rows, "fecha").sort((a, b) => String(a.label).localeCompare(String(b.label))),
    bySeller,
    bySellerCcc,
    byBrand: groupBy(rows, "marca"),
    byCaliber: groupBy(rows, "calibre"),
    byBusiness,
    coverage: {
      cccTotalUng: groupBy(rows.filter((row) => row.negocio === "UNG"), "vendedor", "clientes"),
      cccAguas: groupBy(rows.filter((row) => row.negocio === "Aguas"), "vendedor", "clientes"),
      cccRedBull: groupBy(rows.filter((row) => row.negocio === "Red Bull"), "vendedor", "clientes"),
      cccMarketplace: groupBy(byMarketplace, "vendedor", "clientes"),
      byProduct: groupBy(rows, "productoEstadistico", "clientes")
    },
    brandDistribution: {
      skusByClient: groupBy(rows, "cliente", "skus"),
      distributionByProduct: byProduct,
      topActivation: groupBy(rows, "vendedor", "skus"),
      focusGroups: byFocus
    },
    marketplace: {
      gmvTotal: sum(byMarketplace, "importeNeto"),
      gmvByCategory: groupBy(byMarketplace, "foco"),
      bySeller: groupBy(byMarketplace, "vendedor"),
      ccc: groupBy(byMarketplace, "vendedor", "clientes")
    },
    combosFocus: {
      comboClients: distinctCount(byCombo, "clienteCodigo"),
      byComboType: groupBy(byCombo, "productoEstadistico"),
      bySeller: groupBy(byCombo, "vendedor", "clientes"),
      pendingActivations: []
    },
    operationalDetail: rows.slice(0, 500),
    filters: filterOptions(allRows),
    quality: dataQuality(allRows, parsed.headers || [], parsed.headerIssues || []),
    unavailable: [
      "Objetivo mensual, avance contra objetivo y faltante requieren el Excel mensual de focos/objetivos con metas normalizadas.",
      "Clientes sin compra y % cobertura contra cartera requieren una base de universo/cartera.",
      "Supervisor requiere mapeo vendedor-supervisor si no viene en ventadiaria.",
      "Combos solo se calculan si ventadiaria trae Cantidades en Combos mayor a cero.",
      "Marketplace solo se calcula si las filas contienen Marketplace/Mktplace en negocio o producto."
    ]
  };
}
