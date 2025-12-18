// Hook personnalisé pour gérer le storage
// Remplace window.storage par localStorage pour fonctionner en standalone

export const useStorage = () => {
  const get = async (key) => {
    try {
      const value = localStorage.getItem(key);
      if (value) {
        return { key, value, shared: false };
      }
      return null;
    } catch (error) {
      console.error('Erreur lecture storage:', error);
      return null;
    }
  };

  const set = async (key, value) => {
    try {
      localStorage.setItem(key, value);
      return { key, value, shared: false };
    } catch (error) {
      console.error('Erreur écriture storage:', error);
      return null;
    }
  };

  const remove = async (key) => {
    try {
      localStorage.removeItem(key);
      return { key, deleted: true, shared: false };
    } catch (error) {
      console.error('Erreur suppression storage:', error);
      return null;
    }
  };

  return { get, set, remove };
};
