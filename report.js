import { createObjectCsvWriter } from "csv-writer";

export default async function writeCSV(file, rows) {
  if (!rows.length) return;

  const csv = createObjectCsvWriter({
    path: file,
    header: Object.keys(rows[0]).map(k => ({ id: k, title: k }))
  });

  await csv.writeRecords(rows);
}
