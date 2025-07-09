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
	
	// Inject configuration data into the template
	// Look for <script> tag and inject window.setupConfig before it
	const configScript = `<script>\n\t\t\twindow.setupConfig = ${JSON.stringify(configData)};`;
	
	return template.replace('<script>', configScript);
}

/**
 * Load a template and substitute variables
 * @param assets - The ASSETS binding from Cloudflare Worker
 * @param templateName - The name of the template file
 * @param variables - Variables to substitute in the template (using {{variable}} syntax)
 * @returns Promise<string> - The HTML content with substituted variables
 */
export async function loadTemplateWithVariables(
	assets: Fetcher,
	templateName: string,
	variables: Record<string, string> = {}
): Promise<string> {
	const template = await loadTemplate(assets, templateName);
	
	// Replace variables using simple string replacement
	let result = template;
	for (const [key, value] of Object.entries(variables)) {
		const regex = new RegExp(`{{${key}}}`, 'g');
		result = result.replace(regex, value);
	}
	
	// Handle conditional blocks {{#variable}}...{{/variable}}
	// Remove blocks where the variable is falsy
	result = result.replace(/{{#(\w+)}}([\s\S]*?){{\/\1}}/g, (match, varName, content) => {
		return variables[varName] ? content : '';
	});
	
	return result;
}