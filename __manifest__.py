# -*- coding: utf-8 -*-
{
    'name': 'POS RFID Authentication',
    'version': '12.0.1.1.0',
    'summary': 'RFID authentication for Point of Sale with screen locking',
    'description': """
        This module provides RFID authentication functionality for Point of Sale.
        Features:
        - Screen locking mechanism
        - RFID card authentication
        - PIN + RFID combination authentication
        - HID device integration
        - Enhanced security for POS access
    """,
    'author': 'Industria Creativa',
    'website': 'https://www.industria.com.do',
    'category': 'Point of Sale',
    'depends': ['point_of_sale'],
    'data': [
        'security/ir.model.access.csv',
        'views/res_users_views.xml',
        'views/pos_config_views.xml',
        'views/templates.xml',
    ],
    'qweb': [
        'static/src/xml/pos_rfid_auth.xml',
    ],
    'installable': True,
    'auto_install': False,
    'application': False,
}