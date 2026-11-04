"use client";

import * as React from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowRight, Phone, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import {
  ResponsiveDialog,
  SearchInput,
} from "@/components/shared/StateViews";
import { RecordSyncBadge } from "@/components/shared/StatusBadges";
import { upsertCustomer } from "@/features/utang/utangService";
import { db } from "@/lib/db/dexie";

export default function CustomersDirectoryPage() {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [contactNumber, setContactNumber] = React.useState("");
  const [error, setError] = React.useState("");

  const customers =
    useLiveQuery(async () => db.customers.orderBy("name").toArray(), []) ?? [];
  const utangAccountsQuery = useLiveQuery(
    async () => db.utang_accounts.toArray(),
    []
  );

  const balanceMap = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const acc of utangAccountsQuery ?? []) {
      map.set(acc.customerId, acc.cachedBalanceCentavos);
    }
    return map;
  }, [utangAccountsQuery]);

  const filtered = customers.filter((c) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.contactNumber.includes(q);
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await upsertCustomer({ name, contactNumber });
      setName("");
      setContactNumber("");
      setIsModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save customer");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search customer directory..."
          className="flex-1"
        />
        <Button onClick={() => setIsModalOpen(true)}>
          <UserPlus className="h-4 w-4" />
          Add Customer
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((customer) => {
          const bal = balanceMap.get(customer.id) ?? 0;
          return (
            <Link key={customer.id} href={`/customers/${customer.id}`}>
              <Card className="h-full transition-colors hover:border-primary/50 hover:bg-muted/30">
                <CardContent className="flex flex-col justify-between gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-foreground">
                        {customer.name}
                      </h3>
                      <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" /> {customer.contactNumber}
                      </p>
                    </div>
                    <RecordSyncBadge status={customer.syncStatus} compact />
                  </div>

                  <div className="flex items-center justify-between border-t border-border pt-2.5 text-xs">
                    <div>
                      <span className="text-muted-foreground">
                        Utang Balance:{" "}
                      </span>
                      <CurrencyDisplay
                        centavos={bal}
                        className={
                          bal > 0
                            ? "font-bold text-warning"
                            : "font-bold text-primary"
                        }
                      />
                    </div>
                    <span className="inline-flex items-center gap-1 font-semibold text-primary">
                      Profile & History <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <ResponsiveDialog
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Store Customer"
        description="Customer records store only Name and Contact Number."
      >
        <form onSubmit={handleSave} className="space-y-3.5">
          <div>
            <label
              htmlFor="cust-dir-name"
              className="mb-1 block text-xs font-semibold text-foreground"
            >
              Customer Name
            </label>
            <Input
              id="cust-dir-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Ate Lorna Pascual"
              required
            />
          </div>
          <div>
            <label
              htmlFor="cust-dir-phone"
              className="mb-1 block text-xs font-semibold text-foreground"
            >
              Contact Number
            </label>
            <Input
              id="cust-dir-phone"
              type="tel"
              inputMode="tel"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              placeholder="09171234567"
              error={error}
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Customer</Button>
          </div>
        </form>
      </ResponsiveDialog>
    </div>
  );
}
