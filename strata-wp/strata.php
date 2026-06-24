<?php
/**
 * Plugin Name:       Strata
 * Plugin URI:        https://github.com/jakaria-istauk/strata
 * Description:        Modern, self-hosted MySQL admin client inside wp-admin — a phpMyAdmin replacement with a React UI and WP-aware tools.
 * Version:           0.1.0
 * Requires at least: 6.0
 * Requires PHP:      8.0
 * Author:            Jakaria Istauk
 * Author URI:        https://profiles.wordpress.org/jakariaistauk/
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       strata
 *
 * @package Strata
 */

defined( 'ABSPATH' ) || exit;

define( 'STRATA_VERSION', '0.1.0' );
define( 'STRATA_FILE', __FILE__ );
define( 'STRATA_DIR', plugin_dir_path( __FILE__ ) );
define( 'STRATA_URL', plugin_dir_url( __FILE__ ) );
define( 'STRATA_REST_NS', 'strata/v1' );

require_once STRATA_DIR . 'includes/class-auth.php';
require_once STRATA_DIR . 'includes/class-rest.php';

/**
 * Boot the plugin.
 */
function strata_init() {
	( new Strata_REST() )->register();
}
add_action( 'rest_api_init', 'strata_init' );

/**
 * Admin menu page — single entry, React SPA mounts here.
 */
function strata_admin_menu() {
	$hook = add_menu_page(
		__( 'Strata', 'strata' ),
		__( 'Strata', 'strata' ),
		'manage_options',
		'strata',
		'strata_render_admin_page',
		'dashicons-database',
		80
	);
	add_action( "load-{$hook}", 'strata_enqueue_assets' );
}
add_action( 'admin_menu', 'strata_admin_menu' );

/**
 * Mount point for the SPA.
 */
function strata_render_admin_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( esc_html__( 'You do not have permission to access Strata.', 'strata' ) );
	}
	echo '<div id="strata-root" class="strata-wrap"></div>';
}

/**
 * Enqueue the built SPA + bootstrap data. Only fires on the Strata admin page.
 * Reads the Vite manifest to resolve the hashed entry JS + CSS.
 */
function strata_enqueue_assets() {
	$manifest_path = STRATA_DIR . 'build/.vite/manifest.json';
	if ( ! file_exists( $manifest_path ) ) {
		add_action(
			'admin_notices',
			function () {
				echo '<div class="notice notice-error"><p>';
				echo esc_html__( 'Strata: front-end bundle not built. Run "npm run build:wp".', 'strata' );
				echo '</p></div>';
			}
		);
		return;
	}

	$manifest = json_decode( (string) file_get_contents( $manifest_path ), true );
	$entry    = $manifest['src/main.tsx'] ?? null;
	if ( ! $entry ) {
		return;
	}

	$base = STRATA_URL . 'build/';

	wp_enqueue_script( 'strata-app', $base . $entry['file'], array( 'wp-api-fetch' ), STRATA_VERSION, true );
	wp_enqueue_script( 'wp-api-fetch' );

	// Load the bundle as an ES module.
	add_filter(
		'script_loader_tag',
		function ( $tag, $handle, $src ) {
			if ( 'strata-app' !== $handle ) {
				return $tag;
			}
			return '<script type="module" src="' . esc_url( $src ) . '" id="strata-app-js"></script>';
		},
		10,
		3
	);

	foreach ( (array) ( $entry['css'] ?? array() ) as $css ) {
		wp_enqueue_style( 'strata-app', $base . $css, array(), STRATA_VERSION );
	}

	wp_localize_script(
		'strata-app',
		'StrataBoot',
		array(
			'restUrl'   => esc_url_raw( rest_url( STRATA_REST_NS ) ),
			'nonce'     => wp_create_nonce( 'wp_rest' ),
			'version'   => STRATA_VERSION,
			'assetsUrl' => esc_url_raw( $base . 'assets' ),
		)
	);
}
