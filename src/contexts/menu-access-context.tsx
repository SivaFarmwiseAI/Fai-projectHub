"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  MenuItemConfig,
  RoleType,
  loadMenuAccess,
  saveMenuAccess,
  resetMenuAccess,
  DEFAULT_MENU_ITEMS,
} from "@/lib/menu-access";

type MenuAccessContextType = {
  /** Full list of menu items with current allowedRoles */
  menuItems: MenuItemConfig[];
  /** Toggle a single role on/off for a menu item (non-locked items only) */
  toggleRole: (key: string, role: RoleType) => void;
  /** Replace the full allowedRoles array for a menu item */
  setItemRoles: (key: string, roles: RoleType[]) => void;
  /** Persist current state to localStorage */
  saveConfig: (updatedBy?: string) => void;
  /** Reset everything back to application defaults */
  resetConfig: () => void;
  /** True when in-memory config differs from last-saved config */
  hasUnsavedChanges: boolean;
};

const MenuAccessContext = createContext<MenuAccessContextType | null>(null);

function serialize(items: MenuItemConfig[]) {
  return JSON.stringify(items.map((i) => ({ k: i.key, r: i.allowedRoles })));
}

export function MenuAccessProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // SSR-safe initial state: use defaults; we'll hydrate on the client
  const [menuItems, setMenuItems] = useState<MenuItemConfig[]>(() =>
    DEFAULT_MENU_ITEMS.map((i) => ({ ...i }))
  );
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    serialize(DEFAULT_MENU_ITEMS.map((i) => ({ ...i })))
  );

  // Hydrate from localStorage once the client mounts
  useEffect(() => {
    const loaded = loadMenuAccess();
    setMenuItems(loaded);
    setSavedSnapshot(serialize(loaded));
  }, []);

  const toggleRole = useCallback((key: string, role: RoleType) => {
    setMenuItems((prev) =>
      prev.map((item) => {
        if (item.key !== key || item.locked) return item;
        const has = item.allowedRoles.includes(role);
        return {
          ...item,
          allowedRoles: has
            ? item.allowedRoles.filter((r) => r !== role)
            : [...item.allowedRoles, role],
        };
      })
    );
  }, []);

  const setItemRoles = useCallback((key: string, roles: RoleType[]) => {
    setMenuItems((prev) =>
      prev.map((item) =>
        item.key === key && !item.locked ? { ...item, allowedRoles: roles } : item
      )
    );
  }, []);

  const saveConfig = useCallback(
    (_updatedBy?: string) => {
      setMenuItems((current) => {
        saveMenuAccess(current);
        setSavedSnapshot(serialize(current));
        return current;
      });
    },
    []
  );

  const resetConfig = useCallback(() => {
    const defaults = resetMenuAccess();
    setMenuItems(defaults);
    setSavedSnapshot(serialize(defaults));
  }, []);

  const hasUnsavedChanges = serialize(menuItems) !== savedSnapshot;

  return (
    <MenuAccessContext.Provider
      value={{
        menuItems,
        toggleRole,
        setItemRoles,
        saveConfig,
        resetConfig,
        hasUnsavedChanges,
      }}
    >
      {children}
    </MenuAccessContext.Provider>
  );
}

export function useMenuAccess() {
  const ctx = useContext(MenuAccessContext);
  if (!ctx)
    throw new Error("useMenuAccess must be used inside <MenuAccessProvider>");
  return ctx;
}
