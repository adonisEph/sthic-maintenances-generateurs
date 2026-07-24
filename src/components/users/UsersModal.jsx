import React, { useState, useMemo } from 'react';
import { Users, X, UserPlus, Search, Mail, Shield, MapPin, Wrench, Lock, Save, RotateCcw, Trash2, Edit3 } from 'lucide-react';

const ROLE_LABELS = {
  admin: 'Admin',
  manager: 'Manager',
  manager_bzv_pool: 'Manager BZV/POOL',
  technician: 'Technicien',
  warehouse: 'Magasinier',
  controller: 'Contrôleur',
  field_supervisor: 'Field Supervisor',
  viewer: 'Viewer'
};

const ROLE_COLORS = {
  admin: 'bg-red-100 text-red-700 border-red-200',
  manager: 'bg-blue-100 text-blue-700 border-blue-200',
  manager_bzv_pool: 'bg-purple-100 text-purple-700 border-purple-200',
  technician: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  warehouse: 'bg-amber-100 text-amber-700 border-amber-200',
  controller: 'bg-sky-100 text-sky-700 border-sky-200',
  field_supervisor: 'bg-teal-100 text-teal-700 border-teal-200',
  viewer: 'bg-gray-100 text-gray-600 border-gray-200'
};

const UsersModal = ({
  open,
  users,
  userForm,
  userFormId,
  userFormError,
  onClose,
  onEditUser,
  onDeleteUser,
  onChangeUserForm,
  onSave,
  onReset
}) => {
  const [activeTab, setActiveTab] = useState('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');

  const filteredUsers = useMemo(() => {
    if (!Array.isArray(users)) return [];
    return users.filter((u) => {
      const matchesSearch = !searchQuery ||
        String(u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(u.technicianName || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = filterRole === 'all' || String(u.role || '') === filterRole;
      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, filterRole]);

  const userStats = useMemo(() => {
    if (!Array.isArray(users)) return { total: 0, byRole: {} };
    const byRole = {};
    users.forEach((u) => {
      const r = String(u.role || 'unknown');
      byRole[r] = (byRole[r] || 0) + 1;
    });
    return { total: users.length, byRole };
  }, [users]);

  const handleEditClick = (u) => {
    onEditUser(u);
    setActiveTab('form');
  };

  const handleSaveClick = () => {
    onSave();
  };

  const handleResetClick = () => {
    onReset();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[95vw] h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 px-6 py-4 border-b bg-gradient-to-r from-indigo-700 via-sky-700 to-teal-700 text-white">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-lg p-2">
              <Users size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold">Centre de Gestion des Utilisateurs</h2>
              <p className="text-sm text-white/80">{userStats.total} utilisateur{userStats.total > 1 ? 's' : ''} enregistré{userStats.total > 1 ? 's' : ''}</p>
            </div>
          </div>
          <button onClick={onClose} className="hover:bg-white/15 p-2 rounded-lg transition-colors self-end sm:self-auto">
            <X size={22} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-6 border-b bg-slate-50">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-5 py-3 font-semibold text-sm border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'list'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users size={16} />
            Utilisateurs
            <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === 'list' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-600'}`}>
              {userStats.total}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('form')}
            className={`px-5 py-3 font-semibold text-sm border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'form'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <UserPlus size={16} />
            {userFormId ? 'Modifier' : 'Ajouter'}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Tab: Utilisateurs */}
          {activeTab === 'list' && (
            <div className="p-6">
              {/* Stats cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
                {Object.entries(ROLE_LABELS).map(([roleKey, roleLabel]) => {
                  const count = userStats.byRole[roleKey] || 0;
                  if (count === 0) return null;
                  return (
                    <div key={roleKey} className={`rounded-lg border px-3 py-2 text-center ${ROLE_COLORS[roleKey] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                      <div className="text-2xl font-bold">{count}</div>
                      <div className="text-xs font-medium">{roleLabel}</div>
                    </div>
                  );
                })}
              </div>

              {/* Search & Filter */}
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher par email ou nom..."
                    className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="all">Tous les rôles</option>
                  {Object.entries(ROLE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>

              {/* User table */}
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-gray-600">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold">Email</th>
                      <th className="text-left px-4 py-3 font-semibold">Rôle</th>
                      <th className="text-left px-4 py-3 font-semibold">Zone</th>
                      <th className="text-left px-4 py-3 font-semibold">Technicien</th>
                      <th className="text-right px-4 py-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center text-gray-400 py-8">
                          {Array.isArray(users) && users.length === 0 ? 'Aucun utilisateur enregistré.' : 'Aucun résultat pour cette recherche.'}
                        </td>
                      </tr>
                    )}
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Mail size={14} className="text-gray-400 shrink-0" />
                            <span className="font-medium text-gray-800 truncate">{u.email}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                            <Shield size={12} />
                            {ROLE_LABELS[u.role] || u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-gray-600">
                            <MapPin size={12} className="text-gray-400" />
                            {u.zone || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-gray-600">
                            <Wrench size={12} className="text-gray-400" />
                            {u.technicianName || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEditClick(u)}
                              className="inline-flex items-center gap-1 bg-sky-600 text-white px-3 py-1.5 rounded-lg hover:bg-sky-700 text-xs font-semibold transition-colors"
                            >
                              <Edit3 size={14} />
                              Modifier
                            </button>
                            <button
                              disabled={u.role === 'admin'}
                              onClick={() => onDeleteUser(u)}
                              className="inline-flex items-center gap-1 bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 text-xs font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                            >
                              <Trash2 size={14} />
                              Suppr.
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab: Ajouter / Modifier */}
          {activeTab === 'form' && (
            <div className="p-6 max-w-2xl mx-auto">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <UserPlus size={20} className="text-indigo-600" />
                  {userFormId ? 'Modifier l\'utilisateur' : 'Ajouter un nouvel utilisateur'}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {userFormId ? 'Modifiez les informations ci-dessous puis cliquez sur Enregistrer.' : 'Remplissez le formulaire ci-dessous pour créer un nouveau compte utilisateur.'}
                </p>
              </div>

              <div className="bg-slate-50 rounded-xl border border-gray-200 p-6 space-y-4">
                {/* Email */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                    <Mail size={15} className="text-gray-400" />
                    Email
                  </label>
                  <input
                    type="email"
                    value={userForm.email}
                    onChange={(e) => onChangeUserForm({ ...userForm, email: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="user@domaine.com"
                  />
                </div>

                {/* Role + Zone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                      <Shield size={15} className="text-gray-400" />
                      Rôle
                    </label>
                    <select
                      value={userForm.role}
                      onChange={(e) => onChangeUserForm({ ...userForm, role: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="viewer">Viewer (lecture) [legacy]</option>
                      <option value="controller">Contrôleur (lecture all zones)</option>
                      <option value="field_supervisor">Field Supervisor (lecture zone)</option>
                      <option value="manager">Manager (zone)</option>
                      <option value="manager_bzv_pool">Manager BZV/POOL (management all zones)</option>
                      <option value="warehouse">Magasinier</option>
                      <option value="technician">Technicien</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                      <MapPin size={15} className="text-gray-400" />
                      Zone
                    </label>
                    <select
                      value={userForm.zone || ''}
                      onChange={(e) => onChangeUserForm({ ...userForm, zone: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">— Sélectionner —</option>
                      <option value="BZV/POOL">BZV/POOL</option>
                      <option value="PNR/KOUILOU">PNR/KOUILOU</option>
                      <option value="UPCN">UPCN</option>
                    </select>
                  </div>
                </div>

                {/* Technician name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                    <Wrench size={15} className="text-gray-400" />
                    Nom du technicien {userForm.role === 'technician' ? <span className="text-red-500">*</span> : <span className="text-gray-400 font-normal">(si technicien)</span>}
                  </label>
                  <input
                    type="text"
                    value={userForm.technicianName}
                    onChange={(e) => onChangeUserForm({ ...userForm, technicianName: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Ex: John Doe"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                    <Lock size={15} className="text-gray-400" />
                    Mot de passe
                    {userFormId
                      ? <span className="text-gray-400 font-normal text-xs">(laisser vide pour ne pas changer)</span>
                      : <span className="text-red-500">*</span>
                    }
                  </label>
                  <input
                    type="password"
                    value={userForm.password}
                    onChange={(e) => onChangeUserForm({ ...userForm, password: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="********"
                  />
                </div>

                {/* Error */}
                {userFormError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm flex items-start gap-2">
                    <span className="shrink-0 mt-0.5">⚠</span>
                    <span>{userFormError}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    onClick={handleSaveClick}
                    className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-lg hover:bg-indigo-700 font-semibold text-sm transition-colors"
                  >
                    <Save size={16} />
                    {userFormId ? 'Mettre à jour' : 'Créer l\'utilisateur'}
                  </button>
                  <button
                    onClick={handleResetClick}
                    className="inline-flex items-center justify-center gap-2 bg-gray-200 text-gray-700 px-6 py-2.5 rounded-lg hover:bg-gray-300 font-semibold text-sm transition-colors"
                  >
                    <RotateCcw size={16} />
                    Réinitialiser
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UsersModal;
