import React, { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";
import { Button } from "./button";
import { Input } from "./input";
import { Search, Download, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import * as XLSX from "xlsx";

export interface ColumnDef<T> {
  header: string;
  accessorKey: keyof T | ((row: T) => any);
  cell?: (row: T) => React.ReactNode;
  enableSorting?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  searchPlaceholder?: string;
  exportFilename?: string;
  searchKey?: keyof T; // Used for simple global text search
}

export function DataTable<T>({
  data,
  columns,
  searchPlaceholder = "Pesquisar...",
  exportFilename = "exportacao",
  searchKey,
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string | number; direction: "asc" | "desc" } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 15;

  const handleSort = (column: ColumnDef<T>, index: number) => {
    if (column.enableSorting === false) return;
    
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === index && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key: index, direction });
  };

  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    const lowerSearch = searchTerm.toLowerCase();
    
    return data.filter((item: any) => {
      // If a searchKey is provided, search only there, otherwise search across all columns
      if (searchKey && item[searchKey]) {
        return String(item[searchKey]).toLowerCase().includes(lowerSearch);
      }
      
      // Fallback: search in all values of the object
      return Object.values(item).some((val) => 
        val !== null && val !== undefined && String(val).toLowerCase().includes(lowerSearch)
      );
    });
  }, [data, searchTerm, searchKey]);

  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData;
    
    return [...filteredData].sort((a: any, b: any) => {
      const col = columns[sortConfig.key as number];
      const valA = typeof col.accessorKey === 'function' ? col.accessorKey(a) : a[col.accessorKey];
      const valB = typeof col.accessorKey === 'function' ? col.accessorKey(b) : b[col.accessorKey];
      
      if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
      if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortConfig, columns]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return sortedData.slice(start, start + rowsPerPage);
  }, [sortedData, currentPage]);

  const totalPages = Math.ceil(sortedData.length / rowsPerPage);

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(sortedData.map((row: any) => {
      const formatted: any = {};
      columns.forEach((col) => {
        formatted[col.header] = typeof col.accessorKey === 'function' ? col.accessorKey(row) : row[col.accessorKey];
      });
      return formatted;
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, `${exportFilename}.xlsx`);
  };

  const exportCSV = () => {
    const ws = XLSX.utils.json_to_sheet(sortedData.map((row: any) => {
      const formatted: any = {};
      columns.forEach((col) => {
        formatted[col.header] = typeof col.accessorKey === 'function' ? col.accessorKey(row) : row[col.accessorKey];
      });
      return formatted;
    }));
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${exportFilename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            className="pl-8"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={exportCSV} className="w-full sm:w-auto">
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportExcel} className="w-full sm:w-auto text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 dark:border-emerald-800 dark:hover:bg-emerald-950/50">
            <Download className="mr-2 h-4 w-4" />
            Excel
          </Button>
        </div>
      </div>

      <div className="rounded-md border bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              {columns.map((col, idx) => (
                <TableHead
                  key={idx}
                  className={col.enableSorting !== false ? "cursor-pointer select-none" : ""}
                  onClick={() => handleSort(col, idx)}
                >
                  <div className="flex items-center gap-1">
                    {col.header}
                    {col.enableSorting !== false && <ArrowUpDown className="h-3 w-3 text-muted-foreground" />}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length > 0 ? (
              paginatedData.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {columns.map((col, colIndex) => (
                    <TableCell key={colIndex}>
                      {col.cell ? col.cell(row) : (typeof col.accessorKey === 'function' ? col.accessorKey(row) : (row as any)[col.accessorKey])}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  Nenhum resultado encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Mostrando {Math.min((currentPage - 1) * rowsPerPage + 1, sortedData.length)} a {Math.min(currentPage * rowsPerPage, sortedData.length)} de {sortedData.length} registros
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
          >
            Próxima
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
