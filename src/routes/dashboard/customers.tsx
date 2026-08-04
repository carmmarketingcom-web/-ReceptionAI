import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useContacts, type ContactItem } from "~/lib/hooks/use-data";

export const Route = createFileRoute("/dashboard/customers")({
  component: CustomersPage,
});

type DisplayCustomer = {
  id: string;
  name: string;
  initials: string;
  email: string;
  phone: string;
  totalInteractions: number;
  lastContact: string;
  status: string;
};

// Mock fallback data
const mockCustomers: DisplayCustomer[] = [
  { id: "C-1001", name: "Maria Garcia", initials: "MG", email: "maria.g@email.com", phone: "(555) 123-4567", totalInteractions: 12, lastContact: "Today", status: "active" },
  { id: "C-1002", name: "John Smith", initials: "JS", email: "john.smith@email.com", phone: "(555) 987-6543", totalInteractions: 5, lastContact: "Today", status: "active" },
  { id: "C-1003", name: "Robert Chen", initials: "RC", email: "robert.c@email.com", phone: "(555) 456-7890", totalInteractions: 8, lastContact: "Yesterday", status: "active" },
  { id: "C-1004", name: "Sarah Johnson", initials: "SJ", email: "sarah.j@email.com", phone: "(555) 234-5678", totalInteractions: 3, lastContact: "Yesterday", status: "new" },
  { id: "C-1005", name: "Carlos Mendez", initials: "CM", email: "carlos.m@email.com", phone: "(555) 876-5432", totalInteractions: 15, lastContact: "2 days ago", status: "active" },
  { id: "C-1006", name: "Emily Davis", initials: "ED", email: "emily.d@email.com", phone: "(555) 345-6789", totalInteractions: 2, lastContact: "3 days ago", status: "new" },
  { id: "C-1007", name: "James Wilson", initials: "JW", email: "james.w@email.com", phone: "(555) 567-8901", totalInteractions: 7, lastContact: "4 days ago", status: "active" },
  { id: "C-1008", name: "Lisa Park", initials: "LP", email: "lisa.p@email.com", phone: "(555) 678-9012", totalInteractions: 4, lastContact: "5 days ago", status: "active" },
  { id: "C-1009", name: "David Brown", initials: "DB", email: "david.b@email.com", phone: "(555) 789-0123", totalInteractions: 1, lastContact: "1 week ago", status: "new" },
  { id: "C-1010", name: "Ana Rodriguez", initials: "AR", email: "ana.r@email.com", phone: "(555) 890-1234", totalInteractions: 9, lastContact: "1 week ago", status: "active" },
  { id: "C-1011", name: "Tom Anderson", initials: "TA", email: "tom.a@email.com", phone: "(555) 901-2345", totalInteractions: 0, lastContact: "2 weeks ago", status: "inactive" },
  { id: "C-1012", name: "Jennifer Lee", initials: "JL", email: "jennifer.l@email.com", phone: "(555) 012-3456", totalInteractions: 6, lastContact: "2 weeks ago", status: "active" },
];

function mapApiContact(c: ContactItem): DisplayCustomer {
  const name = c.name || [c.firstName, c.lastName].filter(Boolean).join(" ") || c.phone || "Unknown";
  const initials = c.initials || name.split(" ").map((n: string) => n[0]).join("").toUpperCase();
  return {
    id: c.id,
    name,
    initials,
    email: c.email || "-",
    phone: c.phone || "-",
    totalInteractions: c.totalInteractions || 0,
    lastContact: c.lastContactedAt
      ? new Date(c.lastContactedAt).toLocaleDateString()
      : c.lastContact || "-",
    status: c.status || "active",
  };
}

function CustomersPage() {
  const { data, loading, error, refetch } = useContacts({ limit: 100 });
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<"name" | "lastContact" | "totalInteractions">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const customers: DisplayCustomer[] = (() => {
    if (data?.contacts && data.contacts.length > 0) {
      return data.contacts.map(mapApiContact);
    }
    if (!loading && !error) {
      return mockCustomers;
    }
    return [];
  })();

  const filtered = customers
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") cmp = a.name.localeCompare(b.name);
      if (sortField === "lastContact") cmp = a.lastContact.localeCompare(b.lastContact);
      if (sortField === "totalInteractions") cmp = a.totalInteractions - b.totalInteractions;
      return sortDir === "asc" ? cmp : -cmp;
    });

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        <p className="mt-1 text-sm text-gray-500">Your contact directory.</p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>Could not load contacts. Showing demo data.</span>
          <button onClick={refetch} className="font-medium underline hover:no-underline">Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading && customers.length === 0 && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <svg className="h-8 w-8 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-sm text-gray-500">Loading customers...</p>
          </div>
        </div>
      )}

      {!loading && (
        <>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search customers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      <button onClick={() => toggleSort("name")} className="flex items-center gap-1 hover:text-gray-700">
                        Customer {sortField === "name" && (sortDir === "asc" ? "↑" : "↓")}
                      </button>
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Email</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Phone</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      <button onClick={() => toggleSort("totalInteractions")} className="flex items-center gap-1 hover:text-gray-700">
                        Interactions {sortField === "totalInteractions" && (sortDir === "asc" ? "↑" : "↓")}
                      </button>
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      <button onClick={() => toggleSort("lastContact")} className="flex items-center gap-1 hover:text-gray-700">
                        Last Contact {sortField === "lastContact" && (sortDir === "asc" ? "↑" : "↓")}
                      </button>
                    </th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((c) => (
                    <tr key={c.id} className="transition hover:bg-gray-50">
                      <td className="whitespace-nowrap px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600">
                            {c.initials}
                          </div>
                          <p className="text-sm font-medium text-gray-900">{c.name}</p>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">{c.email}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">{c.phone}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">{c.totalInteractions}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">{c.lastContact}</td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">Message</button>
                          <button className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50">View</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-sm text-gray-500">
                        No customers found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {customers.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white px-6 py-20 text-center">
              <svg className="mb-4 h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900">No contacts yet</h3>
              <p className="mt-1 text-sm text-gray-500">Your customer directory will populate as people interact with your business.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
