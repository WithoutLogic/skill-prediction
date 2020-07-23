'use strict'

const NOCTAN = new Set([1206, 1210, 1230, 1300, 1301, 1302, 1303, 81212, 201225]),
	HOOK_LAST = {order: 100, filter: {fake: null}}

class SPPlayer {
	reset() {
		Object.assign(this, {
			// Session
			gameId: -1n,
			templateId: -1,
			race: -1,
			job: -1,
			kdId: 0,
			// Status
			mounted: false,

			// Combat stats
			attackSpeed: 1,
			stamina: 0,

			// Passivity stuff
			crests: new Set(), // Crests
			epPerks: new Set(), // EP
			skillPolishing: new Set(), // Skill Polishing (Talyphs)

			// Equipment / Inventory
			hasWeapon: false,
			hasNocTan: false,
			itemPassives: []
		})
	}

	constructor(mod) {
		this.reset()

		mod.hook('S_LOGIN', mod.majorPatchVersion >= 86 ? 14 : 13, HOOK_LAST, event => {
			this.reset()

			Object.assign(this, {
				gameId: event.gameId,
				templateId: event.templateId,
				race: Math.floor(event.templateId / 100) % 100 - 1,
				job: event.templateId % 100 - 1,

			})
			this.kdId = this.templateId === 10911 ? 1101102 : (this.templateId * 100 + 2)
		})

		mod.hook('S_RETURN_TO_LOBBY', 'raw', { order: 100, filter: { fake: false } }, () => { this.reset() })

		// Status
		mod.hook('S_MOUNT_VEHICLE', 2, event => { if (event.gameId === this.gameId) this.mounted = true })
		mod.hook('S_UNMOUNT_VEHICLE', 2, event => { if (event.gameId === this.gameId) this.mounted = false })

		// Combat stats
		mod.hook('S_PLAYER_STAT_UPDATE', mod.majorPatchVersion >= 93 ? 14 : 13, HOOK_LAST, event => {
			Object.assign(this, {
				// Newer classes use a different speed algorithm
				attackSpeed: (event.attackSpeed + event.attackSpeedBonus) / (this.job >= 8 ? 100 : event.attackSpeed),
				stamina: event.stamina
			})
		})

		mod.hook('S_PLAYER_CHANGE_STAMINA', 1, HOOK_LAST, event => { this.stamina = event.current })

		// Crests
		mod.hook('S_CREST_INFO', 2, event => { this.crests = new Set(event.crests.filter(c => c.enable).map(c => c.id)) })
		mod.hook('S_CREST_APPLY', 2, event => { this.crests[event.enable ? 'add' : 'delete'](event.id) })

		// EP
		for(let packet of ['S_LOAD_EP_INFO', 'S_LEARN_EP_PERK'])
			mod.hook(packet, 1, HOOK_LAST, event => {
				this.epPerks.clear()
				for(let p of event.perks) this.epPerks.add(`${p.id},${p.level}`)
			})

		mod.hook("S_RESET_EP_PERK", "event", () => {
			this.epPerks.clear();
		});

		// Skill Polishing
		mod.hook('S_RP_SKILL_POLISHING_LIST', 1, event => {
			this.skillPolishing.clear()

			// Skill Advancement
			for(let sp of event.levelEffects)
				this.skillPolishing.add(sp.id)

			// Skill Optimization
			for(let sp of event.optionEffects)
				if(sp.active)
					this.skillPolishing.add(sp.id)
			})

		// Equipment / Inventory
		mod.game.initialize('inventory');
		mod.game.initialize("contract");
		mod.game.inventory.on('update', () => {
			this.hasWeapon = mod.game.inventory.weaponEquipped
			this.itemPassives = mod.game.inventory.equipmentPassivities
			//this.hasNocTan = !!mod.game.inventory.findInBagOrPockets(NOCTAN)
		})
	}
}

module.exports = SPPlayer