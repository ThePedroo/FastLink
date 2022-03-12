export default makeRequest;
/**
 * Makes a request to a website.
 * @param {string} url - The website URL.
 * @param {{ port: number, method: string, headers: object }} options - The options for access the site.
 * @returns {Promise<?>} Returns the response from the website.
 */
declare function makeRequest(url: string, options: {
    port: number;
    method: string;
    headers: object;
}): Promise<unknown>;
