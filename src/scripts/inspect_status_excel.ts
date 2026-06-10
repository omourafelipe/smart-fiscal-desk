import { readFileSync } from 'fs';
import { parseExcelFile, detectColumns, mapExcelRows } from '../src/lib/xlsx-parser';

const xlsxPath = 'C:/Users/fo.moura/Downloads/lovable/smart-fiscal-desk/NFCONScb087061756694885af1aaf8659e.xlsx';

async function main() {
  const buffer = readFileSync(xlsxPath);
  const { headers, rows } = parseExcelFile(buffer.buffer);
  const { keyColumn, statusColumn } = detectColumns(headers);
  const keyCol = keyColumn || headers[0] || '';
  const statusCol = statusColumn || headers[1] || '';
  const items = mapExcelRows(rows, keyCol, statusCol);
  const cancelled = items.filter(i => i.status === 'cancelada');
  console.log('Total rows:', rows.length);
  console.log('Detected columns -> key:', keyCol, 'status:', statusCol);
  console.log('Cancelled count (according to parser):', cancelled.length);
  cancelled.forEach(i => console.log(`Row ${i.rowNumber}: key=${i.rawKey} rawStatus="${i.rawStatus}"`));
}

main();
