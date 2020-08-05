'use strict'

class SPPing {
	constructor(mod) {
		this.min = this.max = this.avg = 45
		this.history = []

		let timeout = null,
			waiting = false,
			lastSent = 0,
			debounce = false

		const ping = () => {
			mod.clearTimeout(timeout)
			mod.send('C_REQUEST_GAMESTAT_PING', 1)
			waiting = true
			lastSent = Date.now()
			timeout = mod.setTimeout(ping, mod.settings.ping.timeout)
		}

		mod.hook('S_SPAWN_ME', 'raw', () => {
			mod.clearTimeout(timeout)
			timeout = mod.setTimeout(ping, mod.settings.ping.interval)
		})

		mod.hook('S_LOAD_TOPO', 'raw', () => { mod.clearTimeout(timeout) })
		mod.hook('S_RETURN_TO_LOBBY', 'raw', () => { mod.clearTimeout(timeout) })

		// Disable inaccurate ingame ping so we have exclusive use of ping packets
		mod.hook('C_REQUEST_GAMESTAT_PING', 'raw', () => {
			if(!debounce && (debounce = true)) {
				mod.command.exec('sp ping') // Display accurate ping statistics in chat
				
				// Enable inaccurate ingame ping
				if(this.history.length > 0) {
					mod.setTimeout(() => { mod.toClient("S_RESPONSE_GAMESTAT_PONG", 1); }, this.history[this.history.length - 1]);
					console.log(`[PSP] Ping=${this.history.length ? `${this.history[this.history.length - 1]}, MinMax=(${this.min}, ${this.max}), Avg=${Math.round(this.avg)}, Variance=${this.max - this.min}, Samples=${this.history.length}` : '???'}`);
				} else {
					mod.setTimeout(() => { mod.toClient("S_RESPONSE_GAMESTAT_PONG", 1); }, this.min);
					console.log(`[PSP] Display inaccurate ingame Ping = (min = max = avg = ${this.min}) + Input Lag`);
				}
			}

			return false
		})

		mod.hook('S_RESPONSE_GAMESTAT_PONG', 'raw', () => {
			const result = Date.now() - lastSent

			mod.clearTimeout(timeout)
			debounce = false

			if(!waiting) this.history.pop() // Oops! We need to recalculate the last value

			this.history.push(result)

			if(this.history.length > mod.settings.ping.maxHistory) this.history.shift()

			// Recalculate statistics variables
			this.min = this.max = this.history[0]
			this.avg = 0

			for(let p of this.history) {
				if(p < this.min) this.min = p
				else if(p > this.max) this.max = p

				this.avg += p
			}

			this.avg /= this.history.length

			waiting = false
			timeout = mod.setTimeout(ping, mod.settings.ping.interval - result)
			
			console.log(`[PSP] Ping=${this.history.length ? `${this.history[this.history.length - 1]}, MinMax=(${this.min}, ${this.max}), Avg=${Math.round(this.avg)}, Variance=${this.max - this.min}, Samples=${this.history.length}` : '???'}`);
			
			return false
		})
	}
}

module.exports = SPPing