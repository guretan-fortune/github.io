(function () {
  const byId = (id) => document.getElementById(id);

  const nodes = {
    particleField: byId("particleField"),
    walletCoin: byId("walletCoin"),
    shopFloorHint: byId("shopFloorHint"),
    walletWeapon: byId("walletWeapon"),
    walletArmor: byId("walletArmor"),
    walletBoots: byId("walletBoots"),
    walletCharm: byId("walletCharm"),
    shopGrid: byId("shopGrid"),
    inventoryList: byId("inventoryList"),
    statsList: byId("statsList"),
    toast: byId("toast"),
  };

  const createDefaultState = () => ({
    player: JSON.parse(JSON.stringify(INITIAL_PLAYER)),
    collection: [],
    cardHistory: [],
    items: Object.values(ITEM_DEFS).reduce((acc, item) => {
      acc[item.id] = item.id === "potion" ? 1 : 0;
      return acc;
    }, {}),
    economy: {
      ocoin: 0,
      equipment: {
        weapon: 0,
        armor: 0,
        boots: 0,
        charm: 0,
      },
    },
    progress: {
      totalVisits: 0,
      visitStreak: 0,
      lastVisitDate: null,
      totalCards: 0,
      bossClears: 0,
      bossLastResult: null,
      currentFloor: 1,
      highestUnlockedFloor: 1,
    },
  });

  const loadState = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createDefaultState();
      const parsed = JSON.parse(raw);
      const base = createDefaultState();
      return {
        ...base,
        ...parsed,
        player: {
          ...base.player,
          ...(parsed.player || {}),
          stats: {
            ...base.player.stats,
            ...((parsed.player && parsed.player.stats) || {}),
          },
        },
        items: { ...base.items, ...(parsed.items || {}) },
        economy: {
          ...base.economy,
          ...(parsed.economy || {}),
          equipment: {
            ...base.economy.equipment,
            ...((parsed.economy && parsed.economy.equipment) || {}),
          },
        },
        progress: { ...base.progress, ...(parsed.progress || {}) },
      };
    } catch {
      return createDefaultState();
    }
  };

  const state = loadState();
  const saveState = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

  const toast = (message) => {
    nodes.toast.textContent = message;
    nodes.toast.classList.add("is-visible");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => nodes.toast.classList.remove("is-visible"), 2200);
  };

  const getEquipmentBonuses = () => ({
    hp: state.economy.equipment.armor * 12,
    attack: state.economy.equipment.weapon * 6,
    defense: state.economy.equipment.armor * 6,
    speed: state.economy.equipment.boots * 4,
    luck: state.economy.equipment.charm * 4,
  });

  const getEffectiveStats = () => {
    const bonus = getEquipmentBonuses();
    return Object.keys(state.player.stats).reduce((acc, key) => {
      acc[key] = state.player.stats[key] + (bonus[key] || 0);
      return acc;
    }, {});
  };

  const buyShopItem = (shopId) => {
    const item = SHOP_ITEMS.find((entry) => entry.id === shopId);
    if (!item) return;
    if (state.economy.ocoin < item.price) {
      toast("ocoin が足りません。");
      return;
    }

    state.economy.ocoin -= item.price;

    if (item.type === "item") state.items[item.target] += 1;
    if (item.type === "item_bundle") state.items[item.target] += item.amount;
    if (item.type === "equipment") state.economy.equipment[item.target] += 1;
    if (item.type === "multi_item") {
      item.rewards.forEach((reward) => {
        state.items[reward.target] = (state.items[reward.target] || 0) + reward.amount;
      });
    }

    saveState();
    renderAll();
    toast(`${item.name} を購入しました。`);
  };

  const renderWallet = () => {
    nodes.walletCoin.textContent = state.economy.ocoin;
    nodes.walletWeapon.textContent = state.economy.equipment.weapon;
    nodes.walletArmor.textContent = state.economy.equipment.armor;
    nodes.walletBoots.textContent = state.economy.equipment.boots;
    nodes.walletCharm.textContent = state.economy.equipment.charm;
    nodes.shopFloorHint.textContent = state.progress.currentFloor >= 10
      ? "地下10階のラスボス戦へ向けた最終補給段階です。"
      : `現在の挑戦先は地下${state.progress.currentFloor}階。次の戦いに備えてください。`;
  };

  const renderShop = () => {
    nodes.shopGrid.innerHTML = SHOP_ITEMS.map((item) => `
      <article class="glass shop-card">
        <p class="panel-label">Shop Item</p>
        <h3>${item.name}</h3>
        <p class="card-copy">${item.description}</p>
        <p class="shop-price">${item.price} ocoin</p>
        <button class="button button-primary button-wide" data-shop-id="${item.id}" type="button" ${state.economy.ocoin >= item.price ? "" : "disabled"}>購入する</button>
      </article>
    `).join("");

    nodes.shopGrid.querySelectorAll("[data-shop-id]").forEach((button) => {
      button.addEventListener("click", () => buyShopItem(button.dataset.shopId));
    });
  };

  const renderInventory = () => {
    nodes.inventoryList.innerHTML = Object.values(ITEM_DEFS).map((item) => `
      <article class="inventory-item">
        <div class="panel-heading-row">
          <div>
            <h4>${item.name}</h4>
            <p class="card-copy">${item.description}</p>
          </div>
          <strong>x${state.items[item.id] || 0}</strong>
        </div>
      </article>
    `).join("");
  };

  const renderStats = () => {
    const effective = getEffectiveStats();
    const base = state.player.stats;
    nodes.statsList.innerHTML = Object.entries(effective).map(([key, value]) => {
      const percentage = Math.min(100, Math.round((value / 220) * 100));
      const bonus = value - base[key];
      return `
        <div class="stat-row">
          <strong>${STAT_LABELS[key]}</strong>
          <div class="gauge-track"><span class="gauge-fill" style="width:${percentage}%"></span></div>
          <span>${value}${bonus > 0 ? ` (+${bonus})` : ""}</span>
        </div>
      `;
    }).join("");
  };

  const createParticles = () => {
    const stars = [];
    for (let index = 0; index < 42; index += 1) {
      stars.push(`<span style="left:${Math.random() * 100}%;top:${Math.random() * 100}%;animation-delay:${Math.random() * 6}s;animation-duration:${4 + Math.random() * 6}s"></span>`);
    }
    nodes.particleField.innerHTML = stars.join("");
  };

  const renderAll = () => {
    renderWallet();
    renderShop();
    renderInventory();
    renderStats();
  };

  createParticles();
  renderAll();
})();
