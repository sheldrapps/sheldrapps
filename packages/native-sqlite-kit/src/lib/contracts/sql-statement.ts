export interface SqlStatement {
  sql: string;
  params?: readonly unknown[];
}
