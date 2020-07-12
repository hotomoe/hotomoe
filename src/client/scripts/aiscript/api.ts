import { utils, values } from '@syuilo/aiscript';

export function createAiScriptEnv(vm, opts) {
	let apiRequests = 0;
	return {
		USER_ID: vm.$store.getters.isSignedIn ? values.STR(vm.$store.state.i.id) : values.NULL,
		USER_NAME: vm.$store.getters.isSignedIn ? values.STR(vm.$store.state.i.name) : values.NULL,
		USER_USERNAME: vm.$store.getters.isSignedIn ? values.STR(vm.$store.state.i.username) : values.NULL,
		'Mk:dialog': values.FN_NATIVE(async ([title, text, type]) => {
			await vm.$root.dialog({
				type: type ? type.value : 'info',
				title: title.value,
				text: text.value,
			});
		}),
		'Mk:confirm': values.FN_NATIVE(async ([title, text]) => {
			const confirm = await vm.$root.dialog({
				type: 'warning',
				showCancelButton: true,
				title: title.value,
				text: text.value,
			});
			return confirm.canceled ? values.FALSE : values.TRUE;
		}),
		'Mk:api': values.FN_NATIVE(async ([ep, param, token]) => {
			if (token) utils.assertString(token);
			apiRequests++;
			if (apiRequests > 16) return values.NULL;
			const res = await vm.$root.api(ep.value, utils.valToJs(param), token ? token.value : null);
			return utils.jsToVal(res);
		}),
		'Mk:save': values.FN_NATIVE(([key, value]) => {
			utils.assertString(key);
			localStorage.setItem('aiscript:' + opts.storageKey + ':' + key.value, JSON.stringify(utils.valToJs(value)));
			return values.NULL;
		}),
		'Mk:load': values.FN_NATIVE(([key]) => {
			utils.assertString(key);
			return utils.jsToVal(JSON.parse(localStorage.getItem('aiscript:' + opts.storageKey + ':' + key.value)));
		}),
	};
}

export function createPluginEnv(vm, opts) {
	return {
		...createAiScriptEnv(vm, opts),
		'Mk:register_post_form_action': values.FN_NATIVE(([title, handler]) => {
			vm.$store.commit('registerPostFormAction', { pluginId: opts.plugin.id, title: title.value, handler });
		}),
		'Mk:register_user_action': values.FN_NATIVE(([title, handler]) => {
			vm.$store.commit('registerUserAction', { pluginId: opts.plugin.id, title: title.value, handler });
		}),
		'Mk:register_note_action': values.FN_NATIVE(([title, handler]) => {
			vm.$store.commit('registerNoteAction', { pluginId: opts.plugin.id, title: title.value, handler });
		}),
	};
}