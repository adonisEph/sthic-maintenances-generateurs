import React from 'react';
import { Users, X } from 'lucide-react';

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
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-indigo-900/35 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[92vh] overflow-hidden flex flex-col">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-4 border-b bg-gradient-to-r from-indigo-600 via-sky-600 to-teal-600 text-white">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Users size={22} />
            Gestion des utilisateurs
          </h2>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="hover:bg-white/10 p-2 rounded">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="font-bold text-gray-800 mb-3">Utilisateurs</div>
              <div className="space-y-2">
                {(Array.isArray(users) ? users : []).map((u) => (
                  <div
                    key={u.id}
                    className="border border-gray-200 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-start"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-800 truncate">{u.email}</div>
                      <div className="text-xs text-gray-600">
                        Rôle: {u.role}
                        {u.zone ? ` | Zone: ${u.zone}` : ''}
                        {u.technicianName ? ` | Technicien: ${u.technicianName}` : ''}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
                      <button
                        onClick={() => onEditUser(u)}
                        className="bg-gray-200 text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-300 text-sm font-semibold w-full sm:w-auto"
                      >
                        Modifier
                      </button>
                      <button
                        disabled={u.role === 'admin'}
                        onClick={() => onDeleteUser(u)}
                        className="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 text-sm font-semibold disabled:bg-gray-400 w-full sm:w-auto"
                      >
                        Suppr.
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
              <div className="font-bold text-gray-800 mb-3">Ajouter / Modifier</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-gray-600 mb-1">Email</label>
                  <input
                    type="email"
                    value={userForm.email}
                    onChange={(e) => onChangeUserForm({ ...userForm, email: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="user@domaine.com"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">Rôle</label>
                  <select
                    value={userForm.role}
                    onChange={(e) => onChangeUserForm({ ...userForm, role: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="viewer">viewer (lecture)</option>
                    <option value="manager">manager (zone)</option>
                    <option value="technician">technician</option>
                    <option value="admin">admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">Zone</label>
                  <select
                    value={userForm.zone || ''}
                    onChange={(e) => onChangeUserForm({ ...userForm, zone: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">-- Sélectionner --</option>
                    <option value="BZV/POOL">BZV/POOL</option>
                    <option value="PNR/KOUILOU">PNR/KOUILOU</option>
                    <option value="UPCN">UPCN</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">Nom technicien (si technician)</label>
                  <input
                    type="text"
                    value={userForm.technicianName}
                    onChange={(e) => onChangeUserForm({ ...userForm, technicianName: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="Ex: John Doe"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs text-gray-600 mb-1">Mot de passe (obligatoire pour créer / changer)</label>
                  <input
                    type="password"
                    value={userForm.password}
                    onChange={(e) => onChangeUserForm({ ...userForm, password: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="********"
                  />
                </div>
              </div>

              {userFormError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm mt-3">
                  {userFormError}
                </div>
              )}

              <div className={`flex flex-col sm:flex-row gap-2 mt-4 ${userFormId ? '' : ''}`}>
                <button
                  onClick={onSave}
                  className="bg-slate-700 text-white px-4 py-2 rounded-lg hover:bg-slate-800 font-semibold w-full sm:w-auto"
                >
                  Enregistrer
                </button>
                <button
                  onClick={onReset}
                  className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 font-semibold w-full sm:w-auto"
                >
                  Réinitialiser
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-3 border-t bg-white" />
      </div>
    </div>
  );
};

export default UsersModal;
