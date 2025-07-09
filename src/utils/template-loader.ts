/**
 * Template loader utility for Cloudflare Worker Assets
 */

export interface TemplateBindings {
	ASSETS: Fetcher;
}

/**
 * Load an HTML template from Cloudflare Worker Assets
 * @param assets - The ASSETS binding from Cloudflare Worker
 * @param templateName - The name of the template file (e.g., 'setup.html')
 * @returns Promise<string> - The HTML content of the template
 */
export async function loadTemplate(assets: Fetcher, templateName: string): Promise<string> {
	try {
		const response = await assets.fetch(new Request(`http://placeholder/${templateName}`));
		
		if (!response.ok) {
			throw new Error(`Failed to load template ${templateName}: ${response.status} ${response.statusText}`);
		}
		
		return await response.text();
	} catch (error) {
		console.error(`Error loading template ${templateName}:`, error);
		throw new Error(`Template ${templateName} not found or failed to load`);
	}
}

/**
 * Escape JSON string for safe injection into HTML script context
 * @param data - The data to stringify and escape
 * @returns The escaped JSON string
 */
function escapeJsonForScript(data: any): string {
	// First stringify the data
	let jsonStr = JSON.stringify(data);
	
	// Escape characters that could break out of script context
	jsonStr = jsonStr
		.replace(/\\/g, '\\\\')  // Escape backslashes first
		.replace(/</g, '\\u003C') // Escape < to prevent </script> injection
		.replace(/>/g, '\\u003E') // Escape > for consistency
		.replace(/\u2028/g, '\\u2028') // Escape line separator
		.replace(/\u2029/g, '\\u2029'); // Escape paragraph separator
	
	return jsonStr;
}

/**
 * Load and inject configuration data into an HTML template
 * @param assets - The ASSETS binding from Cloudflare Worker
 * @param templateName - The name of the template file
 * @param configData - Configuration data to inject into the template
 * @returns Promise<string> - The HTML content with injected configuration
 */
export async function loadTemplateWithConfig(
	assets: Fetcher, 
	templateName: string, 
	configData: any
): Promise<string> {
	const template = await loadTemplate(assets, templateName);
	
	// Create a safe configuration script
	const safeConfigJson = escapeJsonForScript(configData);
	const configScript = `<script>\n\t\t\twindow.setupConfig = ${safeConfigJson};\n\t\t</script>`;
	
	// Find the first script tag (with or without attributes) and inject before it
	// This regex matches <script> tags with optional attributes
	const scriptTagRegex = /<script(?:\s+[^>]*)?>/i;
	
	// Check if template has a script tag
	if (scriptTagRegex.test(template)) {
		// Replace the first occurrence of script tag with config + original script tag
		return template.replace(scriptTagRegex, (match) => {
			return configScript + '\n\t\t' + match;
		});
	} else {
		// If no script tag found, inject at the end of head or body
		const headEndRegex = /<\/head>/i;
		if (headEndRegex.test(template)) {
			return template.replace(headEndRegex, '\t\t' + configScript + '\n\t</head>');
		}
		
		// Otherwise inject before closing body tag
		const bodyEndRegex = /<\/body>/i;
		if (bodyEndRegex.test(template)) {
			return template.replace(bodyEndRegex, '\t\t' + configScript + '\n\t</body>');
		}
		
		// If no proper structure, append at the end
		return template + '\n' + configScript;
	}
}

/**
 * Escape HTML special characters to prevent XSS attacks
 * @param str - The string to escape
 * @returns The escaped string
 */
function escapeHtml(str: string): string {
	const htmlEscapeMap: Record<string, string> = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#39;'
	};
	
	return str.replace(/[&<>"']/g, (match) => htmlEscapeMap[match]);
}

/**
 * Load a template and substitute variables
 * @param assets - The ASSETS binding from Cloudflare Worker
 * @param templateName - The name of the template file
 * @param variables - Variables to substitute in the template (using {{variable}} syntax for escaped values, {{{variable}}} for raw HTML)
 * @returns Promise<string> - The HTML content with substituted variables
 */
export async function loadTemplateWithVariables(
	assets: Fetcher,
	templateName: string,
	variables: Record<string, string> = {}
): Promise<string> {
	const template = await loadTemplate(assets, templateName);
	
	let result = template;
	
	// First, handle raw HTML replacements with triple braces {{{variable}}}
	for (const [key, value] of Object.entries(variables)) {
		const rawRegex = new RegExp(`{{{${key}}}}`, 'g');
		result = result.replace(rawRegex, value);
	}
	
	// Then, handle escaped replacements with double braces {{variable}}
	for (const [key, value] of Object.entries(variables)) {
		const escapedRegex = new RegExp(`{{${key}}}`, 'g');
		result = result.replace(escapedRegex, escapeHtml(value));
	}
	
	// Handle conditional blocks {{#variable}}...{{/variable}}
	// Remove blocks where the variable is falsy
	result = result.replace(/{{#(\w+)}}([\s\S]*?){{\/\1}}/g, (_match, varName, content) => {
		return variables[varName] ? content : '';
	});
	
	return result;
}