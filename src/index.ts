import got from "got";
import http from "http";
import https from "https";
import { CookieJar } from "tough-cookie";
import { URLSearchParams } from "url";

import { ensureTrailingSlash } from "./helpers";
import { Response } from "./response";

type RequestOptions = Record<string, any>;

export class Reqwest {
	/**
	 * The request body format.
	 */
	#bodyFormat!: string;

	/**
	 * The request options.
	 */
	#options: RequestOptions = {};

	/**
	 * Create a new HTTP Client instance.
	 */
	public constructor() {
		this.asJson();
	}

	/**
	 * Create a new HTTP Client instance and set the base URL for the request.
	 */
	public static new(url: string): Reqwest {
		return new Reqwest().baseUrl(url);
	}

	/**
	 * Set the base URL for the request.
	 */
	public baseUrl(url: string): Reqwest {
		this.#options.prefixUrl = ensureTrailingSlash(url);

		return this;
	}

	/**
	 * Indicate the request contains JSON.
	 */
	public asJson(): Reqwest {
		return this.bodyFormat("json").contentType("application/json");
	}

	/**
	 * Indicate the request contains form parameters.
	 */
	public asForm(): Reqwest {
		return this.bodyFormat("form_params").contentType(
			"application/x-www-form-urlencoded"
		);
	}

	/**
	 * Indicate the request is a multi-part form request.
	 */
	public asMultipart(): Reqwest {
		return this.bodyFormat("multipart");
	}

	/**
	 * Specify the body format of the request.
	 */
	public bodyFormat(format: string): Reqwest {
		this.#bodyFormat = format;

		return this;
	}

	/**
	 * Specify the request's content type.
	 */
	public contentType(contentType: string): Reqwest {
		return this.withHeaders({ "Content-Type": contentType });
	}

	/**
	 * Indicate that JSON should be returned by the server.
	 */
	public acceptJson(): Reqwest {
		return this.accept("application/json");
	}

	/**
	 * Indicate the type of content that should be returned by the server.
	 */
	public accept(contentType: string): Reqwest {
		return this.withHeaders({ Accept: contentType });
	}

	/**
	 * Add the given headers to the request.
	 */
	public withHeaders(headers: object): Reqwest {
		this.#options.headers = { ...this.#options.headers, ...headers };

		return this;
	}

	/**
	 * Specify the basic authentication username and password for the request.
	 */
	public withBasicAuth(username: string, password: string): Reqwest {
		return this.withHeaders({
			Authorization: `Basic ${Buffer.from(username + ":" + password).toString(
				"base64"
			)}`,
		});
	}

	/**
	 * Specify the digest authentication username and password for the request.
	 */
	public withDigestAuth(username: string, password: string): Reqwest {
		throw new Error(
			`The [withDigestAuth("${username}", "${password}")] method is not yet supported.`
		);
	}

	/**
	 * Specify an authorization token for the request.
	 */
	public withToken(token: string): Reqwest {
		return this.withHeaders({ Authorization: `Bearer ${token}` });
	}

	/**
	 * Specify the cookies that should be included with the request.
	 */
	public withCookies(cookies: object, domain: string): Reqwest {
		const cookieJar: CookieJar = new CookieJar();

		for (const [key, value] of Object.entries(cookies)) {
			cookieJar.setCookie(`${key}=${value}`, domain);
		}

		this.#options.cookieJar = cookieJar;

		return this;
	}

	/**
	 * Indicate that redirects should not be followed.
	 */
	public withoutRedirecting(): Reqwest {
		this.#options.followRedirects = false;

		return this;
	}

	/**
	 * Indicate that TLS certificates should not be verified.
	 */
	public withoutVerifying(): Reqwest {
		this.#options.verify = false;

		return this;
	}

	/**
	 * Specify the host that should be used as SOCKS proxy.
	 */
	public withAgent(agent: { http: http.Agent; https: https.Agent }): Reqwest {
		this.#options.agent = agent;

		return this;
	}

	/**
	 * Specify the timeout (in seconds) for the request.
	 */
	public timeout(seconds: number): Reqwest {
		this.#options.timeout = seconds;

		return this;
	}

	/**
	 * Specify the number of times the request should be attempted.
	 */
	public retry(times: number, sleep?: number): Reqwest {
		this.#options.retry = {
			limit: times,
			maxRetryAfter: sleep,
		};

		return this;
	}

	/**
	 * Merge new options into the client.
	 */
	public withOptions(options: object): Reqwest {
		this.#options = { ...this.#options, ...options };

		return this;
	}

	/**
	 * Issue a GET request to the given URL.
	 */
	public async get(url: string, query?: object): Promise<Response> {
		return this.send("GET", url, { query });
	}

	/**
	 * Issue a HEAD request to the given URL.
	 */
	public async head(url: string, query?: object): Promise<Response> {
		return this.send("HEAD", url, { query });
	}

	/**
	 * Issue a POST request to the given URL.
	 */
	public async post(url: string, data?: object): Promise<Response> {
		return this.send("POST", url, { data });
	}

	/**
	 * Issue a PATCH request to the given URL.
	 */
	public async patch(url, data?: object): Promise<Response> {
		return this.send("PATCH", url, { data });
	}

	/**
	 * Issue a PUT request to the given URL.
	 */
	public async put(url, data?: object): Promise<Response> {
		return this.send("PUT", url, { data });
	}

	/**
	 * Issue a DELETE request to the given URL.
	 */
	public async delete(url: string, data?: object): Promise<Response> {
		return this.send("DELETE", url, { data });
	}

	/**
	 * Send the request to the given URL.
	 */
	private async send(
		method: string,
		url: string,
		data?: { query?: object; data?: any }
	): Promise<Response> {
		const options: RequestOptions = {
			...this.#options,
		};

		if (data && data.query) {
			options.searchParams = data.query;
		}

		if (data && data.data) {
			if (this.#bodyFormat === "json") {
				options.json = data.data;
			}

			if (this.#bodyFormat === "form_params") {
				options.body = new URLSearchParams();

				for (const [key, value] of Object.entries(data.data)) {
					options.body.set(key, value);
				}
			}

			if (this.#bodyFormat === "multipart") {
				options.body = new FormData();

				for (const [key, value] of Object.entries(data.data)) {
					options.body.append(key, value);
				}
			}
		}

		try {
			return new Response(
				await got[method.toLowerCase()](url.replace(/^\/+/g, ""), options)
			);
		} catch (error) {
			return new Response(error.response, error);
		}
	}
}
