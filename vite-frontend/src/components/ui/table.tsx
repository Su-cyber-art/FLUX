import * as React from "react";
import { Table as MantineTable, Loader } from "@mantine/core";

import { cn } from "@/lib/utils";
interface TableClassNames {
  th?: string;
  td?: string;
  tr?: string;
  wrapper?: string;
}
const TableStyles = React.createContext<TableClassNames>({});

export interface TableProps extends React.ComponentProps<"table"> {
  classNames?: TableClassNames;
}
export function Table({
  children,
  className,
  classNames = {},
  ...props
}: TableProps) {
  return (
    <TableStyles.Provider value={classNames}>
      <div className={cn("app-table-scroll", classNames.wrapper)}>
        <MantineTable
          {...props}
          highlightOnHover
          className={cn("app-table", className)}
          horizontalSpacing="md"
          verticalSpacing="sm"
        >
          {children}
        </MantineTable>
      </div>
    </TableStyles.Provider>
  );
}
export function TableHeader({
  children,
  ...props
}: React.ComponentProps<"thead">) {
  const hasRow = React.Children.toArray(children).some(
    (child) => React.isValidElement(child) && child.type === TableRow,
  );

  return (
    <MantineTable.Thead {...props}>
      {hasRow ? children : <MantineTable.Tr>{children}</MantineTable.Tr>}
    </MantineTable.Thead>
  );
}
interface TableBodyProps<T>
  extends Omit<React.ComponentProps<"tbody">, "children"> {
  children?: React.ReactNode | ((item: T) => React.ReactNode);
  items?: T[];
  isLoading?: boolean;
  loadingContent?: React.ReactNode;
  emptyContent?: React.ReactNode;
}
export const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  TableBodyProps<any>
>(function TableBody(
  { children, items, isLoading, loadingContent, emptyContent, ...props },
  ref,
) {
  let rows: React.ReactNode;

  if (isLoading)
    rows = (
      <MantineTable.Tr>
        <MantineTable.Td colSpan={999}>
          <div className="flex justify-center p-8">
            {loadingContent ?? <Loader size="sm" />}
          </div>
        </MantineTable.Td>
      </MantineTable.Tr>
    );
  else if (
    (items && items.length === 0) ||
    (!items &&
      React.Children.count(typeof children === "function" ? null : children) ===
        0)
  )
    rows = (
      <MantineTable.Tr>
        <MantineTable.Td colSpan={999}>
          <div className="p-8 text-center text-default-500">
            {emptyContent ?? "暂无数据"}
          </div>
        </MantineTable.Td>
      </MantineTable.Tr>
    );
  else
    rows =
      typeof children === "function"
        ? items?.map((item, index) => (
            <React.Fragment key={item.id ?? index}>
              {children(item)}
            </React.Fragment>
          ))
        : children;

  return (
    <MantineTable.Tbody {...props} ref={ref}>
      {rows}
    </MantineTable.Tbody>
  );
});
export function TableColumn({
  className,
  ...props
}: React.ComponentProps<"th">) {
  const style = React.useContext(TableStyles);

  return <MantineTable.Th {...props} className={cn(style.th, className)} />;
}
export const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.ComponentProps<"tr">
>(function TableRow({ className, ...props }, ref) {
  const style = React.useContext(TableStyles);

  return (
    <MantineTable.Tr {...props} ref={ref} className={cn(style.tr, className)} />
  );
});
export function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  const style = React.useContext(TableStyles);

  return <MantineTable.Td {...props} className={cn(style.td, className)} />;
}
