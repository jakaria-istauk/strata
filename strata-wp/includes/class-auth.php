<?php
/**
 * Auth spine — shared permission_callback for every Strata REST route.
 *
 * @package Strata
 */

defined( 'ABSPATH' ) || exit;

/**
 * Centralizes the cap + nonce gate. REST core verifies the `X-WP-Nonce`
 * header against the `wp_rest` action before dispatch; here we add the
 * capability check. Multisite tightens the cap to a super admin.
 */
class Strata_Auth {

	/**
	 * Required capability. Network-admin only on multisite.
	 *
	 * @return string
	 */
	public static function capability() {
		return is_multisite() ? 'manage_network_options' : 'manage_options';
	}

	/**
	 * permission_callback for register_rest_route.
	 *
	 * @return bool|WP_Error
	 */
	public static function guard() {
		if ( ! current_user_can( self::capability() ) ) {
			return new WP_Error(
				'strata_forbidden',
				__( 'You are not allowed to access Strata.', 'strata' ),
				array( 'status' => 403 )
			);
		}
		return true;
	}
}
