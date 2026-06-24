<?php
/**
 * REST controller — registers every Strata action as a WP REST route.
 *
 * Phase 1: a single `ping` smoke route proving the cap + nonce gate.
 * Phase 2 ports the full api.php engine here.
 *
 * @package Strata
 */

defined( 'ABSPATH' ) || exit;

/**
 * Registers Strata REST routes under the strata/v1 namespace.
 */
class Strata_REST {

	/**
	 * Hook every route into the REST API.
	 */
	public function register() {
		register_rest_route(
			STRATA_REST_NS,
			'/ping',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'ping' ),
				'permission_callback' => array( 'Strata_Auth', 'guard' ),
			)
		);
	}

	/**
	 * Smoke route — confirms the request passed the cap + nonce gate.
	 *
	 * @return WP_REST_Response
	 */
	public function ping() {
		return new WP_REST_Response(
			array(
				'ok'      => true,
				'pong'    => true,
				'user'    => wp_get_current_user()->user_login,
				'version' => STRATA_VERSION,
			),
			200
		);
	}
}
