import React from 'react';
import { Edit, X } from 'lucide-react';

const AccountModal = ({
  open,
  email,
  accountForm,
  onChange,
  accountError,
  accountSaving,
  onClose,
  onSave
}) => {
  if (!open || !email) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden flex flex-col">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-4 border-b bg-slate-800 text-white">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Edit size={22} />
            Mon compte
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="hover:bg-slate-900 p-2 rounded"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Email</label>
              <input
                type="email"
                value={email}
                readOnly
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-700"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Nouveau mot de passe</label>
              <input
                type="password"
                value={accountForm.password}
                onChange={(e) => onChange({ ...accountForm, password: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Minimum 6 caractères"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Confirmer le mot de passe</label>
              <input
                type="password"
                value={accountForm.confirm}
                onChange={(e) => onChange({ ...accountForm, confirm: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            {accountError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
                {accountError}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t bg-white flex flex-col sm:flex-row sm:justify-end gap-2">
          <button
            onClick={onClose}
            className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 font-semibold"
            disabled={accountSaving}
          >
            Annuler
          </button>
          <button
            onClick={onSave}
            className="bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900 font-semibold"
            disabled={accountSaving}
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccountModal;
