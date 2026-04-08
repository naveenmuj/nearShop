import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { RefreshCw } from 'lucide-react'
import { getActivityLogs, getShopStaff, getStaffRoles, inviteStaff, removeStaff } from '../../api/staff'

const roleColor = {
  admin: 'bg-indigo-50 text-indigo-700',
  manager: 'bg-amber-50 text-amber-700',
  staff: 'bg-emerald-50 text-emerald-700',
  delivery: 'bg-sky-50 text-sky-700',
}

export default function StaffPage() {
  const [staff, setStaff] = useState([])
  const [roles, setRoles] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [inviting, setInviting] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', role: 'staff' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: staffData }, { data: roleData }, { data: activityData }] = await Promise.all([
        getShopStaff(),
        getStaffRoles(),
        getActivityLogs(null, 30),
      ])
      setStaff(staffData?.items || [])
      setRoles(roleData?.roles || roleData || [])
      const allLogs = Array.isArray(activityData) ? activityData : activityData?.items || []
      setLogs(allLogs.filter((l) => l?.action === 'conversation_assignment_updated').slice(0, 8))
    } catch {
      setStaff([])
      setRoles([])
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const activeCount = useMemo(() => staff.filter((m) => m.status === 'active').length, [staff])

  const invite = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error('Please enter name and phone')
      return
    }
    setInviting(true)
    try {
      await inviteStaff(form.name.trim(), null, form.phone.trim(), form.role)
      toast.success('Staff invited successfully')
      setForm({ name: '', phone: '', role: 'staff' })
      await load()
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Invite failed')
    } finally {
      setInviting(false)
    }
  }

  const remove = async (id) => {
    if (!window.confirm('Remove this staff member?')) return
    try {
      await removeStaff(id)
      toast.success('Staff removed')
      await load()
    } catch {
      toast.error('Failed to remove staff')
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_350px]">
      <section className="desktop-panel overflow-hidden">
        <div className="desktop-toolbar px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
              <p className="text-sm text-gray-500">Manage shop team members and ownership.</p>
            </div>
            <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>
          <div className="mt-3 flex gap-2 text-xs font-semibold">
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">Active {activeCount}</span>
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700">Total {staff.length}</span>
          </div>
        </div>
        {loading ? <div className="p-6 text-sm text-gray-500">Loading staff...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="sticky top-0 z-10 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Action</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {staff.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">No staff members yet.</td></tr>
                ) : staff.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50/70">
                    <td className="px-4 py-3 font-semibold text-gray-900">{m.name}</td>
                    <td className="px-4 py-3 text-gray-700">{m.phone || m.email || '-'}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${roleColor[m.role] || 'bg-gray-100 text-gray-700'}`}>{m.role}</span></td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${m.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{m.status}</span></td>
                    <td className="px-4 py-3"><button onClick={() => remove(m.id)} className="text-xs font-semibold text-red-600 hover:underline">Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <aside className="space-y-4">
        <form onSubmit={invite} className="desktop-panel p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Invite Staff</h3>
          <div className="mt-3 space-y-2">
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Name" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Phone" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              {(roles.length ? roles : [{ key: 'staff', label: 'Staff' }, { key: 'manager', label: 'Manager' }, { key: 'admin', label: 'Admin' }]).map((r) => {
                const value = r.key || r.value
                const label = r.label || r.key || r
                return <option key={value} value={value}>{label}</option>
              })}
            </select>
            <button type="submit" disabled={inviting} className="w-full rounded-lg bg-[#0f766e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0b5e58] disabled:opacity-60">{inviting ? 'Inviting...' : 'Send Invite'}</button>
          </div>
        </form>

        <div className="desktop-panel p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Recent Assignment Activity</h3>
          <div className="mt-3 space-y-2">
            {logs.length === 0 ? <p className="text-xs text-gray-400">No assignment activity.</p> : logs.map((log) => (
              <div key={log.id} className="rounded-lg border border-gray-200 bg-gray-50 p-2.5">
                <p className="text-xs font-semibold text-gray-800">{log.description || 'Conversation assignment updated'}</p>
                <p className="text-[11px] text-gray-500">{log.created_at ? new Date(log.created_at).toLocaleString('en-IN') : ''}</p>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  )
}
