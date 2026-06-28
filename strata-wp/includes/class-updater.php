<?php
/**
 * GitHub release updater — surfaces a plugin update notice in wp-admin when a
 * newer tagged release is published on GitHub, and serves the release zip as
 * the update package. No third-party libraries; uses the WP HTTP + transient
 * APIs and the GitHub REST "latest release" endpoint.
 *
 * @package Strata
 */

defined( 'ABSPATH' ) || exit;

class Strata_Updater {

	/** GitHub "owner/repo" the releases are published under. */
	const REPO = 'jakaria-istauk/strata';

	/** Transient key + TTL (12h) for the cached GitHub release payload. */
	const CACHE_KEY = 'strata_gh_release';
	const CACHE_TTL = 12 * HOUR_IN_SECONDS;

	/** @var string Absolute plugin file (the main plugin bootstrap). */
	private $file;

	/** @var string Plugin basename, e.g. "strata/strata.php". */
	private $basename;

	/** @var string Plugin folder slug, e.g. "strata". */
	private $slug;

	/** @var string Currently installed version. */
	private $version;

	public function __construct( $file, $version ) {
		$this->file     = $file;
		$this->version  = $version;
		$this->basename = plugin_basename( $file );
		$this->slug     = dirname( $this->basename );
		if ( '.' === $this->slug ) {
			$this->slug = basename( $file, '.php' );
		}
	}

	/**
	 * Wire the update-check + info hooks.
	 */
	public function register() {
		add_filter( 'pre_set_site_transient_update_plugins', array( $this, 'inject_update' ) );
		// Sanitise the cached transient on every read (no network) so a stale
		// "update available" row self-heals on plain page views, not only when
		// WP rebuilds the transient.
		add_filter( 'site_transient_update_plugins', array( $this, 'sanitize_transient' ) );
		add_filter( 'plugins_api', array( $this, 'plugin_info' ), 20, 3 );
		// Normalise the extracted folder name so the update lands back in our slug.
		add_filter( 'upgrader_source_selection', array( $this, 'fix_source_dir' ), 10, 4 );
		// Bust the cache after a successful update so we don't re-offer it.
		add_action( 'upgrader_process_complete', array( $this, 'flush_cache' ), 10, 2 );
	}

	/**
	 * Rename the unpacked release directory to the plugin slug.
	 *
	 * GitHub's source zipball (and an asset zip whose top folder isn't the slug,
	 * e.g. "strata-wp/") unpacks to a differently-named directory. Without this,
	 * WordPress would install the update into that new folder, orphaning and
	 * deactivating the original. Scoped strictly to our own update via the
	 * hook_extra plugin path so other plugins' updates are untouched.
	 *
	 * @param string      $source        Unpacked source directory (…/strata-xxxx/).
	 * @param string      $remote_source The WP_Upgrader working dir.
	 * @param WP_Upgrader $upgrader
	 * @param array       $hook_extra
	 * @return string|WP_Error The corrected source path.
	 */
	public function fix_source_dir( $source, $remote_source, $upgrader, $hook_extra = array() ) {
		if ( empty( $hook_extra['plugin'] ) || $hook_extra['plugin'] !== $this->basename ) {
			return $source;
		}

		$desired = trailingslashit( $remote_source ) . $this->slug;
		$source  = untrailingslashit( $source );

		if ( $source === untrailingslashit( $desired ) ) {
			return trailingslashit( $desired );
		}

		global $wp_filesystem;
		if ( $wp_filesystem && $wp_filesystem->move( $source, $desired, true ) ) {
			return trailingslashit( $desired );
		}

		// Move failed — return the original so the update can still proceed.
		return trailingslashit( $source );
	}

	/**
	 * Fetch the latest GitHub release (cached). Returns null on failure.
	 *
	 * @return array{version:string,zip:string,url:string,published:string,body:string}|null
	 */
	private function latest_release() {
		$cached = get_transient( self::CACHE_KEY );
		if ( false !== $cached ) {
			return is_array( $cached ) ? $cached : null;
		}

		$res = wp_remote_get(
			'https://api.github.com/repos/' . self::REPO . '/releases/latest',
			array(
				'timeout' => 10,
				'headers' => array(
					'Accept'     => 'application/vnd.github+json',
					'User-Agent' => 'Strata-Updater',
				),
			)
		);

		if ( is_wp_error( $res ) || 200 !== (int) wp_remote_retrieve_response_code( $res ) ) {
			// Cache the miss briefly so a flaky API doesn't hammer every page load.
			set_transient( self::CACHE_KEY, '', 10 * MINUTE_IN_SECONDS );
			return null;
		}

		$data = json_decode( wp_remote_retrieve_body( $res ), true );
		if ( ! is_array( $data ) || empty( $data['tag_name'] ) ) {
			set_transient( self::CACHE_KEY, '', 10 * MINUTE_IN_SECONDS );
			return null;
		}

		// Prefer an uploaded .zip asset; fall back to GitHub's source zipball.
		$zip = '';
		foreach ( (array) ( $data['assets'] ?? array() ) as $asset ) {
			if ( ! empty( $asset['browser_download_url'] ) && '.zip' === substr( (string) $asset['name'], -4 ) ) {
				$zip = (string) $asset['browser_download_url'];
				break;
			}
		}
		if ( '' === $zip ) {
			$zip = (string) ( $data['zipball_url'] ?? '' );
		}

		$release = array(
			'version'   => ltrim( (string) $data['tag_name'], 'vV' ),
			'zip'       => $zip,
			'url'       => (string) ( $data['html_url'] ?? '' ),
			'published' => (string) ( $data['published_at'] ?? '' ),
			'body'      => (string) ( $data['body'] ?? '' ),
		);

		set_transient( self::CACHE_KEY, $release, self::CACHE_TTL );
		return $release;
	}

	/**
	 * Inject our plugin into the "has update" transient when GitHub is ahead.
	 *
	 * @param mixed $transient The update_plugins transient.
	 * @return mixed
	 */
	public function inject_update( $transient ) {
		if ( ! is_object( $transient ) ) {
			return $transient;
		}

		$release = $this->latest_release();

		// A genuinely newer release exists only when the fetch succeeded, has a
		// package, AND its version is ahead of what's installed.
		$has_update = $release
			&& '' !== $release['zip']
			&& version_compare( $release['version'], $this->version, '>' );

		if ( $has_update ) {
			$transient->response[ $this->basename ] = (object) array(
				'slug'        => $this->slug,
				'plugin'      => $this->basename,
				'new_version' => $release['version'],
				'package'     => $release['zip'],
				'url'         => $release['url'],
				'tested'      => get_bloginfo( 'version' ),
			);
			unset( $transient->no_update[ $this->basename ] );
			return $transient;
		}

		// No newer release — OR the GitHub check failed/was rate-limited. Either
		// way clear any stale "update available" row so the phantom notice
		// self-heals even when the API is unreachable (the early-return that
		// used to live here let a stale row survive a failed fetch), then list
		// under no_update so WP shows the correct state.
		unset( $transient->response[ $this->basename ] );
		$transient->no_update[ $this->basename ] = (object) array(
			'slug'        => $this->slug,
			'plugin'      => $this->basename,
			'new_version' => $this->version,
			'package'     => '',
			'url'         => $release ? $release['url'] : '',
		);

		return $transient;
	}

	/**
	 * Strip a stale "update available" row from the cached transient on read.
	 *
	 * Runs on every `get_site_transient('update_plugins')` with zero network
	 * cost. `inject_update` only fires when WP *rebuilds* the transient; between
	 * rebuilds the persisted transient can still carry a phantom response row
	 * (e.g. left by an out-of-band file update). This drops any row for our
	 * plugin whose advertised version isn't actually newer than what's
	 * installed, so the notice clears on a plain page view.
	 *
	 * @param mixed $transient The update_plugins transient.
	 * @return mixed
	 */
	public function sanitize_transient( $transient ) {
		if ( ! is_object( $transient ) || empty( $transient->response[ $this->basename ] ) ) {
			return $transient;
		}

		$row = $transient->response[ $this->basename ];
		$new = isset( $row->new_version ) ? (string) $row->new_version : '';

		if ( '' === $new || version_compare( $new, $this->version, '<=' ) ) {
			unset( $transient->response[ $this->basename ] );
			if ( ! isset( $transient->no_update ) || ! is_array( $transient->no_update ) ) {
				$transient->no_update = array();
			}
			$transient->no_update[ $this->basename ] = (object) array(
				'slug'        => $this->slug,
				'plugin'      => $this->basename,
				'new_version' => $this->version,
				'package'     => '',
				'url'         => isset( $row->url ) ? $row->url : '',
			);
		}

		return $transient;
	}

	/**
	 * Provide the "View details" modal payload for our slug.
	 *
	 * @param false|object|array $result
	 * @param string             $action
	 * @param object             $args
	 * @return false|object
	 */
	public function plugin_info( $result, $action, $args ) {
		if ( 'plugin_information' !== $action || empty( $args->slug ) || $args->slug !== $this->slug ) {
			return $result;
		}

		$release = $this->latest_release();
		if ( ! $release ) {
			return $result;
		}

		$changelog = trim( $release['body'] );

		return (object) array(
			'name'          => 'Strata',
			'slug'          => $this->slug,
			'version'       => $release['version'],
			'author'        => '<a href="https://profiles.wordpress.org/jakariaistauk/">Jakaria Istauk</a>',
			'homepage'      => $release['url'],
			'download_link' => $release['zip'],
			'requires'      => '6.0',
			'requires_php'  => '8.0',
			'last_updated'  => $release['published'],
			'sections'      => array(
				'changelog' => '' !== $changelog
					? wpautop( wp_kses_post( $changelog ) )
					: '<p>See the release on <a href="' . esc_url( $release['url'] ) . '">GitHub</a>.</p>',
			),
		);
	}

	/**
	 * Clear the cached release after a plugin update completes.
	 *
	 * @param WP_Upgrader $upgrader
	 * @param array       $data
	 */
	public function flush_cache( $upgrader, $data ) {
		if ( isset( $data['type'], $data['action'] ) && 'plugin' === $data['type'] && 'update' === $data['action'] ) {
			delete_transient( self::CACHE_KEY );
		}
	}
}
