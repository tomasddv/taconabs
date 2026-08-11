import iconv from "iconv-lite";
import Papa from "papaparse";

const FIELD_ALIASES = {
  fecha: ["Descripción Período"],
  clienteCodigo: ["Cod. Cliente"],
  cliente: ["Clientes", "Descripción"],
  rutaCodigo: ["Ruta"],
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
  facturas: ["Cantidad de Facturas"]
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
    const suffixed = Object.keys(row).find((key) => key === candidate || key.startsWith(`${candidate}__`));
    if (suffixed) return row[suffixed];
  }
  return "";
}

export function parseVentaDiaria(buffer) {
  const text = iconv.decode(buffer, "win1252");
  const parsed = Papa.parse(text, {
    delimiter: "\t",
    header: false,
    skipEmptyLines: true
  });

  const [rawHeaders, ...rawRows] = parsed.data;
  const headers = dedupeHeaders(rawHeaders);

  return rawRows
    .filter((row) => row.length > 5)
    .map((row) => {
      const source = Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]));
      return {
        fecha: pick(source, FIELD_ALIASES.fecha),
        clienteCodigo: pick(source, FIELD_ALIASES.clienteCodigo),
        cliente: pick(source, FIELD_ALIASES.cliente),
        rutaCodigo: pick(source, FIELD_ALIASES.rutaCodigo),
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
        facturas: numberFromAr(pick(source, FIELD_ALIASES.facturas))
      };
    });
}

function groupBy(rows, key, metrics = ["hl", "importeNeto", "importeFinal", "facturas"]) {
  const grouped = new Map();
  for (const row of rows) {
    const label = row[key] || "Sin dato";
    const current = grouped.get(label) || { label, rows: 0, clientes: new Set() };
    current.rows += 1;
    current.clientes.add(row.clienteCodigo || row.cliente);
    for (const metric of metrics) {
      current[metric] = (current[metric] || 0) + Number(row[metric] || 0);
    }
    grouped.set(label, current);
  }
  return [...grouped.values()]
    .map((item) => ({ ...item, clientes: item.clientes.size }))
    .sort((a, b) => (b.hl || 0) - (a.hl || 0));
}

export function summarizeVenta(rows) {
  const totals = rows.reduce(
    (acc, row) => {
      acc.hl += row.hl;
      acc.importeNeto += row.importeNeto;
      acc.importeFinal += row.importeFinal;
      acc.facturas += row.facturas;
      acc.clientes.add(row.clienteCodigo || row.cliente);
      acc.fechas.add(row.fecha);
      return acc;
    },
    { hl: 0, importeNeto: 0, importeFinal: 0, facturas: 0, clientes: new Set(), fechas: new Set() }
  );

  return {
    generatedAt: new Date().toISOString(),
    source: "ventadiaria.txt",
    ignoredSources: ["ventadiaria bultos.txt"],
    totalRows: rows.length,
    totals: {
      hl: totals.hl,
      importeNeto: totals.importeNeto,
      importeFinal: totals.importeFinal,
      facturas: totals.facturas,
      clientes: totals.clientes.size,
      diasVenta: totals.fechas.size
    },
    byDay: groupBy(rows, "fecha"),
    bySeller: groupBy(rows, "vendedor"),
    byBrand: groupBy(rows, "marca"),
    byCaliber: groupBy(rows, "calibre"),
    byBusinessUnit: groupBy(rows, "unidadNegocio"),
    sampleRows: rows.slice(0, 50)
  };
}
