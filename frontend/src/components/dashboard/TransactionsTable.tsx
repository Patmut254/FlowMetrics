import { Link } from "react-router-dom";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/ui/Badge";
import { Table, Td, Th } from "@/components/ui/Table";
import { formatCurrency, formatDate, humanize } from "@/lib/format";
import type { Transaction } from "@/types";

/** Compact transactions table shared by the dashboard and customer detail page. */
export function TransactionsTable({
  transactions,
  showCustomer = true,
  showReference = true,
}: {
  transactions: Transaction[];
  showCustomer?: boolean;
  showReference?: boolean;
}) {
  return (
    <Table>
      <thead>
        <tr>
          {showCustomer && <Th>Customer</Th>}
          {showReference && <Th>Reference</Th>}
          <Th>Plan</Th>
          <Th>Date</Th>
          <Th>Status</Th>
          <Th className="text-right">Amount</Th>
        </tr>
      </thead>
      <tbody>
        {transactions.map((txn) => (
          <tr key={txn.id} className="hover:bg-surface-2">
            {showCustomer && (
              <Td>
                <Link to={`/customers/${txn.customer.id}`} className="flex items-center gap-3 rounded-md">
                  <Avatar name={txn.customer.company_name} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ink hover:underline">{txn.customer.company_name}</span>
                    <span className="block truncate text-xs text-muted">{txn.customer.email}</span>
                  </span>
                </Link>
              </Td>
            )}
            {showReference && <Td className="font-mono text-xs whitespace-nowrap text-ink-2">{txn.reference}</Td>}
            <Td>
              <span className="text-ink">{txn.plan ?? "—"}</span>
              {txn.billing_cycle && <span className="block text-xs text-muted">{humanize(txn.billing_cycle)}</span>}
            </Td>
            <Td className="whitespace-nowrap text-ink-2">{formatDate(txn.occurred_at)}</Td>
            <Td>
              <StatusBadge status={txn.status} />
            </Td>
            <Td className="text-right font-semibold text-ink tabular">{formatCurrency(txn.amount)}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
