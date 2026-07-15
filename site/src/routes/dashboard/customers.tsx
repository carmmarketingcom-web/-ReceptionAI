import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/dashboard/customers")({
  component: CustomersPage,
});

type Customer = {
  id: string;
  name: string;
  initials: string;
  email: string;
  phone: string;
  totalInteractions: number;
  lastContact: string;
  status: "active" | "new" | "inactive";
};

const customers: Customer[] = [
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

function CustomersPage() {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<"name" | "lastContact" | "totalInteractions">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

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
    </div>
  );
}