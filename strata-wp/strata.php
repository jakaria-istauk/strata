<?php
/**
 * Plugin Name:       Strata
 * Plugin URI:        https://github.com/wpdeveloper/strata
 * Description:        Modern, self-hosted MySQL admin client inside wp-admin — a phpMyAdmin replacement with a React UI and WP-aware tools.
 * Version:           0.1.0
 * Requires at least: 6.0
 * Requires PHP:      8.0
 * Author:            Jakaria Istauk
 * Author URI:        https://wpdeveloper.com
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
 */
function strata_enqueue_assets() {
	wp_enqueue_script( 'wp-api-fetch' );

	wp_localize_script(
		'wp-api-fetch',
		'StrataBoot',
		array(
			'restUrl' => esc_url_raw( rest_url( STRATA_REST_NS ) ),
			'nonce'   => wp_create_nonce( 'wp_rest' ),
			'version' => STRATA_VERSION,
		)
	);
}
