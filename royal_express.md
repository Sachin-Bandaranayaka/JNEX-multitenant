Order Status List
A request to the following endpoint returns a list of all possible Order Statuses used in our system

Request
GET - {{url}}/api/public/merchant/order/status-list

Headers
{
  "Accept": "application/json",
  "Authorization": "Bearer {{ token }}",
  "Content-Type": "application/json",
  "X-Tenant": "{{ tenant }}",
}
Response
Status - 200 - OK

Sample Response Object
{
    "data": [
        {
            "id": 1,
            "key": "key_1",
            "name": "DRAFT",
            "original_name": null,
            "description": "Draft status of the order",
            "is_branch_status": false,
            "is_core_status": true,
            "is_finance_status": 0,
            "is_merchant_status": 1,
            "is_walking_status": 1,
            "is_reversal_status": false,
            "icon": "Edit3Icon",
            "color": "secondary",
            "before_statuses": [],
            "after_statuses": [
                "key_2"
            ],
            "created_at": "2022-03-03T07:42:36.000000Z",
            "updated_at": "2022-03-03T07:42:36.000000Z"
        },
        {
            "id": 2,
            "key": "key_2",
            "name": "CONFIRMED",
            "original_name": null,
            "description": "Confirm status of the order",
            "is_branch_status": false,
            "is_core_status": true,
            "is_finance_status": 0,
            "is_merchant_status": 1,
            "is_walking_status": 1,
            "is_reversal_status": true,
            "icon": "CheckSquareIcon",
            "color": "primary",
            "before_statuses": [
                "key_1"
            ],
            "after_statuses": [
                "key_4",
                "key_5",
                "key_9",
                "key_3"
            ],
            "created_at": "2022-03-03T07:42:36.000000Z",
            "updated_at": "2022-03-03T07:42:36.000000Z"
        },
        {
            "id": 3,
            "key": "key_3",
            "name": "CANCELLED",
            "original_name": null,
            "description": "Cancel status of the order",
            "is_branch_status": true,
            "is_core_status": true,
            "is_finance_status": 0,
            "is_merchant_status": 1,
            "is_walking_status": 1,
            "is_reversal_status": true,
            "icon": "XCircleIcon",
            "color": "danger",
            "before_statuses": [
                "key_2"
            ],
            "after_statuses": [],
            "created_at": "2022-03-03T07:42:36.000000Z",
            "updated_at": "2022-03-03T07:42:36.000000Z"
        },
        {
            "id": 4,
            "key": "key_4",
            "name": "DEFAULT WAREHOUSE CHANGE",
            "original_name": null,
            "description": "select default warehouse status of the order",
            "is_branch_status": true,
            "is_core_status": true,
            "is_finance_status": 0,
            "is_merchant_status": 1,
            "is_walking_status": 1,
            "is_reversal_status": true,
            "icon": "CheckSquareIcon",
            "color": "primary",
            "before_statuses": [
                "key_2"
            ],
            "after_statuses": [
                "key_5",
                "key_9"
            ],
            "created_at": "2022-03-03T07:42:36.000000Z",
            "updated_at": "2022-03-03T07:42:36.000000Z"
        },
        {
            "id": 5,
            "key": "key_5",
            "name": "PICKUP RIDER ASSIGNED",
            "original_name": null,
            "description": "pickup rider assign status of the order",
            "is_branch_status": true,
            "is_core_status": true,
            "is_finance_status": 0,
            "is_merchant_status": 1,
            "is_walking_status": 1,
            "is_reversal_status": true,
            "icon": "ClipboardIcon",
            "color": "info",
            "before_statuses": [
                "key_2",
                "key_4"
            ],
            "after_statuses": [
                "key_6"
            ],
            "created_at": "2022-03-03T07:42:36.000000Z",
            "updated_at": "2022-03-03T07:42:36.000000Z"
        },
        {
            "id": 6,
            "key": "key_6",
            "name": "PICKED UP",
            "original_name": null,
            "description": "picked up status of the order",
            "is_branch_status": true,
            "is_core_status": true,
            "is_finance_status": 0,
            "is_merchant_status": 1,
            "is_walking_status": 1,
            "is_reversal_status": true,
            "icon": "AnchorIcon",
            "color": "info",
            "before_statuses": [
                "key_5"
            ],
            "after_statuses": [
                "key_7",
                "key_8"
            ],
            "created_at": "2022-03-03T07:42:36.000000Z",
            "updated_at": "2022-03-03T07:42:36.000000Z"
        },
        {
            "id": 7,
            "key": "key_7",
            "name": "DELIVERED BY PICKUP RIDER",
            "original_name": null,
            "description": "delivered by pickup rider status of the order",
            "is_branch_status": true,
            "is_core_status": true,
            "is_finance_status": 1,
            "is_merchant_status": 1,
            "is_walking_status": 1,
            "is_reversal_status": true,
            "icon": "LogInIcon",
            "color": "success",
            "before_statuses": [
                "key_6"
            ],
            "after_statuses": [],
            "created_at": "2022-03-03T07:42:36.000000Z",
            "updated_at": "2022-03-03T07:42:36.000000Z"
        },
        {
            "id": 8,
            "key": "key_8",
            "name": "DISPATCH TO ORIGIN WAREHOUSE",
            "original_name": null,
            "description": "dispatch to origin warehouse(where rider belongs to) status of the order",
            "is_branch_status": true,
            "is_core_status": true,
            "is_finance_status": 0,
            "is_merchant_status": 1,
            "is_walking_status": 1,
            "is_reversal_status": true,
            "icon": "GitMergeIcon",
            "color": "info",
            "before_statuses": [
                "key_6"
            ],
            "after_statuses": [
                "key_9",
                "key_11"
            ],
            "created_at": "2022-03-03T07:42:36.000000Z",
            "updated_at": "2022-03-03T07:42:36.000000Z"
        },
        {
            "id": 9,
            "key": "key_9",
            "name": "RECEIVED TO ORIGIN WAREHOUSE",
            "original_name": null,
            "description": "received to origin warehouse status of the order",
            "is_branch_status": true,
            "is_core_status": true,
            "is_finance_status": 0,
            "is_merchant_status": 1,
            "is_walking_status": 1,
            "is_reversal_status": true,
            "icon": "GitPullRequestIcon",
            "color": "primary",
            "before_statuses": [
                "key_2",
                "key_4",
                "key_8"
            ],
            "after_statuses": [
                "key_10"
            ],
            "created_at": "2022-03-03T07:42:36.000000Z",
            "updated_at": "2022-03-03T07:42:36.000000Z"
        },
        {
            "id": 10,
            "key": "key_10",
            "name": "DISPATCHED FROM ORIGIN WAREHOUSE",
            "original_name": null,
            "description": "dispatch from origin warehouse status of the order",
            "is_branch_status": true,
            "is_core_status": true,
            "is_finance_status": 0,
            "is_merchant_status": 1,
            "is_walking_status": 1,
            "is_reversal_status": true,
            "icon": "TruckIcon",
            "color": "primary",
            "before_statuses": [
                "key_9"
            ],
            "after_statuses": [
                "key_11"
            ],
            "created_at": "2022-03-03T07:42:36.000000Z",
            "updated_at": "2022-03-03T07:42:36.000000Z"
        },
        {
            "id": 11,
            "key": "key_11",
            "name": "RECEIVED AT DESTINATION WAREHOUSE",
            "original_name": null,
            "description": "received at destination warehouse status of the order",
            "is_branch_status": true,
            "is_core_status": true,
            "is_finance_status": 0,
            "is_merchant_status": 1,
            "is_walking_status": 1,
            "is_reversal_status": true,
            "icon": "GitBranchIcon",
            "color": "info",
            "before_statuses": [
                "key_8",
                "key_10"
            ],
            "after_statuses": [
                "key_12"
            ],
            "created_at": "2022-03-03T07:42:36.000000Z",
            "updated_at": "2022-03-03T07:42:36.000000Z"
        },
        {
            "id": 12,
            "key": "key_12",
            "name": "ASSIGNED TO DESTINATION RIDER",
            "original_name": null,
            "description": "assign to destination rider status of the order",
            "is_branch_status": true,
            "is_core_status": true,
            "is_finance_status": 0,
            "is_merchant_status": 1,
            "is_walking_status": 1,
            "is_reversal_status": true,
            "icon": "NavigationIcon",
            "color": "info",
            "before_statuses": [
                "key_11",
                "key_16"
            ],
            "after_statuses": [
                "key_13",
                "key_14",
                "key_15"
            ],
            "created_at": "2022-03-03T07:42:36.000000Z",
            "updated_at": "2022-03-03T07:42:36.000000Z"
        },
        {
            "id": 13,
            "key": "key_13",
            "name": "DELIVERED",
            "original_name": null,
            "description": "delivered status of the order",
            "is_branch_status": true,
            "is_core_status": true,
            "is_finance_status": 1,
            "is_merchant_status": 1,
            "is_walking_status": 1,
            "is_reversal_status": true,
            "icon": "CheckIcon",
            "color": "success",
            "before_statuses": [
                "key_12"
            ],
            "after_statuses": [],
            "created_at": "2022-03-03T07:42:36.000000Z",
            "updated_at": "2022-03-03T07:42:36.000000Z"
        },
        {
            "id": 14,
            "key": "key_14",
            "name": "PARTIALLY DELIVERED",
            "original_name": null,
            "description": "partially delivered status of the order",
            "is_branch_status": true,
            "is_core_status": true,
            "is_finance_status": 1,
            "is_merchant_status": 1,
            "is_walking_status": 1,
            "is_reversal_status": true,
            "icon": "CheckCircleIcon",
            "color": "success",
            "before_statuses": [
                "key_12"
            ],
            "after_statuses": [],
            "created_at": "2022-03-03T07:42:36.000000Z",
            "updated_at": "2022-03-03T07:42:36.000000Z"
        },
        {
            "id": 15,
            "key": "key_15",
            "name": "RETURN TO DESTINATION WAREHOUSE",
            "original_name": null,
            "description": "return to destination warehouse status of the order",
            "is_branch_status": true,
            "is_core_status": true,
            "is_finance_status": 0,
            "is_merchant_status": 1,
            "is_walking_status": 1,
            "is_reversal_status": true,
            "icon": "CornerDownLeftIcon",
            "color": "warning",
            "before_statuses": [
                "key_12"
            ],
            "after_statuses": [
                "key_16",
                "key_17"
            ],
            "created_at": "2022-03-03T07:42:36.000000Z",
            "updated_at": "2022-03-03T07:42:36.000000Z"
        },
        {
            "id": 16,
            "key": "key_16",
            "name": "RESCHEDULED",
            "original_name": null,
            "description": "rescheduled status of the order",
            "is_branch_status": true,
            "is_core_status": true,
            "is_finance_status": 0,
            "is_merchant_status": 1,
            "is_walking_status": 1,
            "is_reversal_status": true,
            "icon": "RepeatIcon",
            "color": "warning",
            "before_statuses": [
                "key_15"
            ],
            "after_statuses": [
                "key_12"
            ],
            "created_at": "2022-03-03T07:42:36.000000Z",
            "updated_at": "2022-03-03T07:42:36.000000Z"
        },
        {
            "id": 17,
            "key": "key_17",
            "name": "FAILED TO DELIVER",
            "original_name": null,
            "description": "failed to deliver status of the order",
            "is_branch_status": true,
            "is_core_status": true,
            "is_finance_status": 0,
            "is_merchant_status": 1,
            "is_walking_status": 1,
            "is_reversal_status": true,
            "icon": "ThumbsDownIcon",
            "color": "danger",
            "before_statuses": [
                "key_15"
            ],
            "after_statuses": [
                "key_16",
                "key_18"
            ],
            "created_at": "2022-03-03T07:42:36.000000Z",
            "updated_at": "2022-03-03T07:42:36.000000Z"
        },
        {
            "id": 18,
            "key": "key_18",
            "name": "RETURN TO ORIGIN WAREHOUSE",
            "original_name": null,
            "description": "return to origin warehouse status of the order",
            "is_branch_status": true,
            "is_core_status": true,
            "is_finance_status": 0,
            "is_merchant_status": 1,
            "is_walking_status": 1,
            "is_reversal_status": true,
            "icon": "UploadIcon",
            "color": "danger",
            "before_statuses": [
                "key_17"
            ],
            "after_statuses": [
                "key_19"
            ],
            "created_at": "2022-03-03T07:42:36.000000Z",
            "updated_at": "2022-03-03T07:42:36.000000Z"
        },
        {
            "id": 19,
            "key": "key_19",
            "name": "RECEIVED TO ORIGIN WAREHOUSE (FAILED TO DELIVER)",
            "original_name": null,
            "description": "received to origin warehouse(FD) status of the order",
            "is_branch_status": true,
            "is_core_status": true,
            "is_finance_status": 0,
            "is_merchant_status": 1,
            "is_walking_status": 1,
            "is_reversal_status": true,
            "icon": "ChevronsDownIcon",
            "color": "danger",
            "before_statuses": [
                "key_18"
            ],
            "after_statuses": [
                "key_20"
            ],
            "created_at": "2022-03-03T07:42:36.000000Z",
            "updated_at": "2022-03-03T07:42:36.000000Z"
        },
        {
            "id": 20,
            "key": "key_20",
            "name": "RETURN TO CLIENT",
            "original_name": null,
            "description": "return to client status of the order",
            "is_branch_status": true,
            "is_core_status": true,
            "is_finance_status": 1,
            "is_merchant_status": 1,
            "is_walking_status": 1,
            "is_reversal_status": true,
            "icon": "ArrowDownLeftIcon",
            "color": "danger",
            "before_statuses": [
                "key_19"
            ],
            "after_statuses": [
                "key_21"
            ],
            "created_at": "2022-03-03T07:42:37.000000Z",
            "updated_at": "2022-03-03T07:42:37.000000Z"
        },
        {
            "id": 21,
            "key": "key_21",
            "name": "RECEIVED FAILED ORDER",
            "original_name": null,
            "description": "received failed order status of the order",
            "is_branch_status": true,
            "is_core_status": true,
            "is_finance_status": 1,
            "is_merchant_status": 1,
            "is_walking_status": 1,
            "is_reversal_status": false,
            "icon": "CornerRightDownIcon",
            "color": "danger",
            "before_statuses": [
                "key_20"
            ],
            "after_statuses": [],
            "created_at": "2022-03-03T07:42:37.000000Z",
            "updated_at": "2022-03-03T07:42:37.000000Z"
        }
    ]
}
ERRORS
Invalid Bearer Token
{
    "message": "Unauthenticated."
}


Tracking Information (Private)
The following request can be made to get a detailed lifeline of an order since it was created

Request
GET - {{url}}/api/public/merchant/order/tracking-info

Headers
{
  "Accept": "application/json",
  "Authorization": "Bearer {{ token }}",
  "Content-Type": "application/json",
  "X-tenant": "{{ tenant }}",
}
Sample Payload
{
    "waybill_number": "MG0001201",
}
Response
Status - 200 - OK

Sample Response Object
{
    "data": [
        {
            "status": {
                "name": "CONFIRMED",
            },
            "date_time": "2022-02-19T19:06:23.000000Z",
            "date_time_ago": "1 month ago",
            "user": {
                "first_name": "Mr. John",
                "last_name": "Doe"
            },
        },
        {
            "status": {
                "name": "DRAFT",
            },
            "date_time": "2022-02-19T19:05:57.000000Z",
            "date_time_ago": "1 month ago",
            "user": {
                "first_name": "Mr. John",
                "last_name": "Doe"
            },
        }
    ]
}
Response Payload Objects
data : Array - An array of statuses that the order has been in since it was created with details of when and who initiated the status change

ERRORS
Invalid Bearer Token
{
    "message": "Unauthenticated."
}
Waybill number of the order has not been provided in the request payload
{
    "message": "The given data was invalid.",
    "errors": {
        "waybill_number": [
            "The waybill number field is required."
        ]
    }
}
The requested waybill does not exist in the system
{
    "message": "The requested waybill does not exist in the system"
}


Order Finance Information (Private)
The following request can be made to obtain comprehensive finance-related information for a specific order.

Request
GET - {{url}}/api/merchant/order/waybill-finance-status

Headers
{
  "Accept": "application/json",
  "Authorization": "Bearer {{ token }}",
  "Content-Type": "application/json",
  "X-tenant": "{{ tenant }}",
}
Sample Payload
{
    "waybill_number": "CA000032"
}
This API endpoint returns essential finance-related details for a specific waybill. The response includes the current finance status of the order, denoted by the "finance_status" field, which indicates whether the invoice status is Pending, Deposited or Approved. Additionally, the response provides the reference number ("invoice_ref_no") and unique invoice number ("invoice_no") associated with the order only if it is invoiced. These details offer comprehensive insight into the financial status of the order, facilitating efficient tracking and management.

Response
Status - 200 - OK

Sample Response Object
{
    "data": {
        "finance_status": "Deposited",
        "invoice_ref_no": "MI-0004",
        "invoice_no": "CFX-23-08-00004"
    }
}
ERRORS
Invalid Bearer Token
{
    "message": "Unauthenticated."
}
The requested waybill does not exist in the system
{
    "message": "The requested waybill does not exist in the system"
}