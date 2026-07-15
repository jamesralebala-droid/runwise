from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
import hashlib
import json
from datetime import datetime, timedelta
import os
import secrets

app = Flask(__name__)
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET', 'your-secret-key-change-in-production')
CORS(app)

@app.errorhandler(422)
def handle_unprocessable_entity(error):
    return jsonify({'error': str(error)}), 422

jwt = JWTManager(app)

DB_PATH = ':memory:'
users_data = {}
trips_data = {}
requests_data = {}
bookings_data = {}
orders_data = {}
wallets_data = {}
transactions_data = {}
ratings_data = {}

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password, hash):
    return hash_password(password) == hash

def init_db():
    global users_data, trips_data, requests_data, bookings_data, orders_data, wallets_data, transactions_data, ratings_data
    users_data = {}
    trips_data = {}
    requests_data = {}
    bookings_data = {}
    orders_data = {}
    wallets_data = {}
    transactions_data = {}
    ratings_data = {}
    print("In-memory database initialized")

def next_id(data_dict):
    return max(data_dict.keys()) + 1 if data_dict else 1

def get_user_id():
    """Get the current user ID from JWT identity (converted from string to int)"""
    return int(get_jwt_identity())

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'message': 'RunWise API running'})

@app.route('/api/auth/register', methods=['POST'])
def register():
    try:
        data = request.json
        email = data.get('email')
        password = data.get('password')
        name = data.get('name')
        role = data.get('role', 'customer')

        if not email or not password or not name:
            return jsonify({'error': 'Missing required fields'}), 400

        if any(u['email'] == email for u in users_data.values()):
            return jsonify({'error': 'Email already exists'}), 400

        user_id = next_id(users_data)
        users_data[user_id] = {
            'id': user_id,
            'email': email,
            'password_hash': hash_password(password),
            'name': name,
            'role': role,
            'phone': None,
            'verified': 0,
            'kyc_status': 'pending',
            'rating': 5,
            'created_at': datetime.now().isoformat()
        }

        wallets_data[user_id] = {
            'id': user_id,
            'user_id': user_id,
            'balance': 0,
            'pending': 0,
            'frozen': 0,
            'total_earned': 0,
            'created_at': datetime.now().isoformat()
        }

        token = create_access_token(identity=str(user_id), expires_delta=timedelta(days=30))
        return jsonify({
            'token': token,
            'userId': user_id,
            'email': email,
            'name': name,
            'role': role
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/auth/login', methods=['POST'])
def login():
    try:
        data = request.json
        email = data.get('email')
        password = data.get('password')

        user = next((u for u in users_data.values() if u['email'] == email), None)
        if not user or not verify_password(password, user['password_hash']):
            return jsonify({'error': 'Invalid credentials'}), 401

        token = create_access_token(identity=str(user['id']), expires_delta=timedelta(days=30))
        return jsonify({
            'token': token,
            'userId': user['id'],
            'email': user['email'],
            'name': user['name'],
            'role': user['role']
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/trips', methods=['GET'])
def get_trips():
    trips = [t for t in trips_data.values() if t['status'] == 'published']
    return jsonify(trips)

@app.route('/api/trips', methods=['POST'])
@jwt_required()
def create_trip():
    try:
        user_id = get_user_id()
        data = request.json

        trip_id = next_id(trips_data)
        trips_data[trip_id] = {
            'id': trip_id,
            'runner_id': user_id,
            'from_city': data.get('from_city'),
            'to_city': data.get('to_city'),
            'departure_date': data.get('departure_date'),
            'departure_time': data.get('departure_time'),
            'capacity_kg': data.get('capacity_kg'),
            'available_spaces': 6,
            'stops': data.get('stops', ''),
            'status': 'published',
            'runner_name': users_data[user_id]['name'],
            'rating': users_data[user_id]['rating'],
            'created_at': datetime.now().isoformat()
        }

        return jsonify({'id': trip_id, 'status': 'published'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/requests', methods=['GET'])
@jwt_required()
def get_requests():
    user_id = get_user_id()
    reqs = [r for r in requests_data.values()]
    return jsonify(reqs)

@app.route('/api/requests', methods=['POST'])
@jwt_required()
def create_request():
    try:
        user_id = get_user_id()
        data = request.json

        req_id = next_id(requests_data)
        requests_data[req_id] = {
            'id': req_id,
            'customer_id': user_id,
            'type': data.get('type'),
            'from_city': data.get('from_city'),
            'to_city': data.get('to_city'),
            'value': data.get('value'),
            'details': data.get('details', ''),
            'status': 'open',
            'runner_id': None,
            'created_at': datetime.now().isoformat()
        }

        return jsonify({'id': req_id, 'status': 'open'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/bookings', methods=['POST'])
@jwt_required()
def create_booking():
    try:
        customer_id = get_user_id()
        data = request.json

        booking_id = next_id(bookings_data)
        trip_id = data.get('trip_id')
        request_id = data.get('request_id')
        runner_id = trips_data[trip_id]['runner_id'] if trip_id else data.get('runner_id')

        bookings_data[booking_id] = {
            'id': booking_id,
            'trip_id': trip_id,
            'request_id': request_id,
            'customer_id': customer_id,
            'runner_id': runner_id,
            'status': 'pending',
            'created_at': datetime.now().isoformat()
        }

        return jsonify({'id': booking_id, 'status': 'pending'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/bookings/<int:booking_id>/accept', methods=['POST'])
@jwt_required()
def accept_booking(booking_id):
    try:
        runner_id = get_user_id()
        booking = bookings_data.get(booking_id)

        if not booking or booking['runner_id'] != runner_id:
            return jsonify({'error': 'Booking not found or unauthorized'}), 404

        booking['status'] = 'accepted'

        escrow_amount = 1500
        order_id = next_id(orders_data)
        orders_data[order_id] = {
            'id': order_id,
            'booking_id': booking_id,
            'customer_id': booking['customer_id'],
            'runner_id': runner_id,
            'status': 'created',
            'escrow_status': 'awaiting_funding',
            'escrow_amount': escrow_amount,
            'runner_fee': 100,
            'platform_fee': 50,
            'delivery_pin': None,
            'delivery_pin_verified': 0,
            'current_milestone': 'created',
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }

        return jsonify({'orderId': order_id, 'status': 'accepted', 'escrow_status': 'awaiting_funding'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/orders/<int:order_id>', methods=['GET'])
@jwt_required()
def get_order(order_id):
    try:
        user_id = get_user_id()
        order = orders_data.get(order_id)

        if not order or (order['customer_id'] != user_id and order['runner_id'] != user_id):
            return jsonify({'error': 'Order not found'}), 404

        return jsonify({**order, 'messages': [], 'proof': []})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/orders/<int:order_id>/messages', methods=['POST'])
@jwt_required()
def send_message(order_id):
    try:
        user_id = get_user_id()
        data = request.json

        order = orders_data.get(order_id)
        if not order or (order['customer_id'] != user_id and order['runner_id'] != user_id):
            return jsonify({'error': 'Unauthorized'}), 401

        return jsonify({'id': 1, 'message': data.get('message')})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/orders/<int:order_id>/proof', methods=['POST'])
@jwt_required()
def upload_proof(order_id):
    try:
        user_id = get_user_id()
        data = request.json

        order = orders_data.get(order_id)
        if not order or (order['customer_id'] != user_id and order['runner_id'] != user_id):
            return jsonify({'error': 'Unauthorized'}), 401

        return jsonify({'id': 1, 'proof_type': data.get('proof_type')})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/orders/<int:order_id>/verify-pin', methods=['POST'])
@jwt_required()
def verify_pin(order_id):
    try:
        customer_id = get_user_id()
        data = request.json
        pin = data.get('pin')

        order = orders_data.get(order_id)
        if not order or order['customer_id'] != customer_id:
            return jsonify({'error': 'Unauthorized'}), 401

        if order['delivery_pin'] != pin:
            return jsonify({'error': 'Invalid PIN'}), 401

        order['delivery_pin_verified'] = 1
        order['status'] = 'delivered'
        order['escrow_status'] = 'released'

        runner_id = order['runner_id']
        if runner_id not in wallets_data:
            wallets_data[runner_id] = {
                'id': runner_id,
                'user_id': runner_id,
                'balance': 0,
                'pending': 0,
                'frozen': 0,
                'total_earned': 0,
                'created_at': datetime.now().isoformat()
            }

        earning = order['escrow_amount'] - order['platform_fee'] - order['runner_fee']
        wallets_data[runner_id]['balance'] += earning
        wallets_data[runner_id]['total_earned'] += earning

        return jsonify({'status': 'delivered', 'escrow': 'released'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/wallets/<int:user_id>', methods=['GET'])
@jwt_required()
def get_wallet(user_id):
    try:
        if user_id not in wallets_data:
            wallets_data[user_id] = {
                'id': user_id,
                'user_id': user_id,
                'balance': 0,
                'pending': 0,
                'frozen': 0,
                'total_earned': 0,
                'created_at': datetime.now().isoformat()
            }

        return jsonify(wallets_data[user_id])
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/payments/fund', methods=['POST'])
@jwt_required()
def fund_escrow():
    try:
        customer_id = get_user_id()
        data = request.json
        order_id = data.get('orderId')

        order = orders_data.get(order_id)
        if not order or order['customer_id'] != customer_id:
            return jsonify({'error': 'Unauthorized'}), 401

        order['escrow_status'] = 'funded'
        order['delivery_pin'] = f"{secrets.randbelow(1000000):06d}"

        return jsonify({'status': 'funded', 'delivery_pin': order['delivery_pin']})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/withdrawals', methods=['POST'])
@jwt_required()
def withdraw():
    try:
        user_id = get_user_id()
        data = request.json
        amount = data.get('amount')

        wallet = wallets_data.get(user_id)
        if not wallet or wallet['balance'] < amount:
            return jsonify({'error': 'Insufficient balance'}), 400

        wallet['balance'] -= amount

        txn_id = len(transactions_data) + 1
        transactions_data[txn_id] = {
            'id': txn_id,
            'user_id': user_id,
            'type': 'withdrawal',
            'amount': amount,
            'status': 'completed',
            'created_at': datetime.now().isoformat()
        }

        return jsonify({'status': 'withdrawn', 'amount': amount, 'remaining': wallet['balance']})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/ratings', methods=['POST'])
@jwt_required()
def submit_rating():
    try:
        from_user_id = get_user_id()
        data = request.json

        rating_id = len(ratings_data) + 1
        ratings_data[rating_id] = {
            'id': rating_id,
            'order_id': data.get('order_id'),
            'from_user_id': from_user_id,
            'to_user_id': data.get('to_user_id'),
            'score': data.get('score'),
            'feedback': data.get('feedback', ''),
            'created_at': datetime.now().isoformat()
        }

        to_user = users_data.get(data.get('to_user_id'))
        if to_user:
            ratings = [r for r in ratings_data.values() if r['to_user_id'] == to_user['id']]
            if ratings:
                avg_score = sum(r['score'] for r in ratings) / len(ratings)
                to_user['rating'] = round(avg_score, 1)

        return jsonify({'id': rating_id, 'score': data.get('score')})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/user/<int:user_id>', methods=['GET'])
def get_user(user_id):
    try:
        user = users_data.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        return jsonify({
            'id': user['id'],
            'email': user['email'],
            'name': user['name'],
            'role': user['role'],
            'phone': user['phone'],
            'verified': user['verified'],
            'kyc_status': user['kyc_status'],
            'rating': user['rating']
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/vehicles', methods=['POST'])
@jwt_required()
def add_vehicle():
    try:
        user_id = get_user_id()
        data = request.json

        return jsonify({'id': 1, 'user_id': user_id})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    init_db()
    print("RunWise API Server starting on port 5001...")
    print("Access at http://localhost:5001")
    app.run(debug=True, port=5001, host='0.0.0.0')


@app.route('/api/trips', methods=['GET'])
def get_trips():
    trips = [t for t in trips_data.values() if t['status'] == 'published']
    return jsonify(trips)

@app.route('/api/trips', methods=['POST'])
@jwt_required()
def create_trip():
    try:
        user_id = get_user_id()
        data = request.json

        trip_id = next_id(trips_data)
        trips_data[trip_id] = {
            'id': trip_id,
            'runner_id': user_id,
            'from_city': data.get('from_city'),
            'to_city': data.get('to_city'),
            'departure_date': data.get('departure_date'),
            'departure_time': data.get('departure_time'),
            'capacity_kg': data.get('capacity_kg'),
            'available_spaces': 6,
            'stops': data.get('stops', ''),
            'status': 'published',
            'runner_name': users_data[user_id]['name'],
            'rating': users_data[user_id]['rating'],
            'created_at': datetime.now().isoformat()
        }

        return jsonify({'id': trip_id, 'status': 'published'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/requests', methods=['GET'])
@jwt_required()
def get_requests():
    user_id = get_user_id()
    reqs = [r for r in requests_data.values()]
    return jsonify(reqs)

@app.route('/api/requests', methods=['POST'])
@jwt_required()
def create_request():
    try:
        user_id = get_user_id()
        data = request.json

        req_id = next_id(requests_data)
        requests_data[req_id] = {
            'id': req_id,
            'customer_id': user_id,
            'type': data.get('type'),
            'from_city': data.get('from_city'),
            'to_city': data.get('to_city'),
            'value': data.get('value'),
            'details': data.get('details', ''),
            'status': 'open',
            'runner_id': None,
            'created_at': datetime.now().isoformat()
        }

        return jsonify({'id': req_id, 'status': 'open'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/bookings', methods=['POST'])
@jwt_required()
def create_booking():
    try:
        customer_id = get_user_id()
        data = request.json

        booking_id = next_id(bookings_data)
        trip_id = data.get('trip_id')
        request_id = data.get('request_id')
        runner_id = trips_data[trip_id]['runner_id'] if trip_id else data.get('runner_id')

        bookings_data[booking_id] = {
            'id': booking_id,
            'trip_id': trip_id,
            'request_id': request_id,
            'customer_id': customer_id,
            'runner_id': runner_id,
            'status': 'pending',
            'created_at': datetime.now().isoformat()
        }

        return jsonify({'id': booking_id, 'status': 'pending'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/bookings/<int:booking_id>/accept', methods=['POST'])
@jwt_required()
def accept_booking(booking_id):
    try:
        runner_id = get_user_id()
        booking = bookings_data.get(booking_id)

        if not booking or booking['runner_id'] != runner_id:
            return jsonify({'error': 'Booking not found or unauthorized'}), 404

        booking['status'] = 'accepted'

        escrow_amount = 1500
        order_id = next_id(orders_data)
        orders_data[order_id] = {
            'id': order_id,
            'booking_id': booking_id,
            'customer_id': booking['customer_id'],
            'runner_id': runner_id,
            'status': 'created',
            'escrow_status': 'awaiting_funding',
            'escrow_amount': escrow_amount,
            'runner_fee': 100,
            'platform_fee': 50,
            'delivery_pin': None,
            'delivery_pin_verified': 0,
            'current_milestone': 'created',
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }

        return jsonify({'orderId': order_id, 'status': 'accepted', 'escrow_status': 'awaiting_funding'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/orders/<int:order_id>', methods=['GET'])
@jwt_required()
def get_order(order_id):
    try:
        user_id = get_user_id()
        order = orders_data.get(order_id)

        if not order or (order['customer_id'] != user_id and order['runner_id'] != user_id):
            return jsonify({'error': 'Order not found'}), 404

        return jsonify({**order, 'messages': [], 'proof': []})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/orders/<int:order_id>/messages', methods=['POST'])
@jwt_required()
def send_message(order_id):
    try:
        user_id = get_user_id()
        data = request.json

        # Validate order access
        order = orders_data.get(order_id)
        if not order or (order['customer_id'] != user_id and order['runner_id'] != user_id):
            return jsonify({'error': 'Unauthorized'}), 401

        return jsonify({'id': 1, 'message': data.get('message')})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/orders/<int:order_id>/proof', methods=['POST'])
@jwt_required()
def upload_proof(order_id):
    try:
        user_id = get_user_id()
        data = request.json

        order = orders_data.get(order_id)
        if not order or (order['customer_id'] != user_id and order['runner_id'] != user_id):
            return jsonify({'error': 'Unauthorized'}), 401

        return jsonify({'id': 1, 'proof_type': data.get('proof_type')})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/orders/<int:order_id>/verify-pin', methods=['POST'])
@jwt_required()
def verify_pin(order_id):
    try:
        customer_id = get_user_id()
        data = request.json
        pin = data.get('pin')

        order = orders_data.get(order_id)
        if not order or order['customer_id'] != customer_id:
            return jsonify({'error': 'Unauthorized'}), 401

        if order['delivery_pin'] != pin:
            return jsonify({'error': 'Invalid PIN'}), 401

        order['delivery_pin_verified'] = 1
        order['status'] = 'delivered'
        order['escrow_status'] = 'released'

        # Credit runner wallet
        runner_id = order['runner_id']
        if runner_id not in wallets_data:
            wallets_data[runner_id] = {
                'id': runner_id,
                'user_id': runner_id,
                'balance': 0,
                'pending': 0,
                'frozen': 0,
                'total_earned': 0,
                'created_at': datetime.now().isoformat()
            }

        earning = order['escrow_amount'] - order['platform_fee'] - order['runner_fee']
        wallets_data[runner_id]['balance'] += earning
        wallets_data[runner_id]['total_earned'] += earning

        return jsonify({'status': 'delivered', 'escrow': 'released'})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/wallets/<int:user_id>', methods=['GET'])
@jwt_required()
def get_wallet(user_id):
    try:
        if user_id not in wallets_data:
            wallets_data[user_id] = {
                'id': user_id,
                'user_id': user_id,
                'balance': 0,
                'pending': 0,
                'frozen': 0,
                'total_earned': 0,
                'created_at': datetime.now().isoformat()
            }

        return jsonify(wallets_data[user_id])
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/payments/fund', methods=['POST'])
@jwt_required()
def fund_escrow():
    try:
        customer_id = get_user_id()
        data = request.json
        order_id = data.get('orderId')

        order = orders_data.get(order_id)
        if not order or order['customer_id'] != customer_id:
            return jsonify({'error': 'Unauthorized'}), 401

        order['escrow_status'] = 'funded'
        order['delivery_pin'] = f"{secrets.randbelow(1000000):06d}"

        return jsonify({'status': 'funded', 'delivery_pin': order['delivery_pin']})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/withdrawals', methods=['POST'])
@jwt_required()
def withdraw():
    try:
        user_id = get_user_id()
        data = request.json
        amount = data.get('amount')

        wallet = wallets_data.get(user_id)
        if not wallet or wallet['balance'] < amount:
            return jsonify({'error': 'Insufficient balance'}), 400

        wallet['balance'] -= amount

        txn_id = len(transactions_data) + 1
        transactions_data[txn_id] = {
            'id': txn_id,
            'user_id': user_id,
            'type': 'withdrawal',
            'amount': amount,
            'status': 'completed',
            'created_at': datetime.now().isoformat()
        }

        return jsonify({'status': 'withdrawn', 'amount': amount, 'remaining': wallet['balance']})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/ratings', methods=['POST'])
@jwt_required()
def submit_rating():
    try:
        from_user_id = get_user_id()
        data = request.json

        rating_id = len(ratings_data) + 1
        ratings_data[rating_id] = {
            'id': rating_id,
            'order_id': data.get('order_id'),
            'from_user_id': from_user_id,
            'to_user_id': data.get('to_user_id'),
            'score': data.get('score'),
            'feedback': data.get('feedback', ''),
            'created_at': datetime.now().isoformat()
        }

        # Update user rating
        to_user = users_data.get(data.get('to_user_id'))
        if to_user:
            ratings = [r for r in ratings_data.values() if r['to_user_id'] == to_user['id']]
            if ratings:
                avg_score = sum(r['score'] for r in ratings) / len(ratings)
                to_user['rating'] = round(avg_score, 1)

        return jsonify({'id': rating_id, 'score': data.get('score')})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/user/<int:user_id>', methods=['GET'])
def get_user(user_id):
    try:
        user = users_data.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        return jsonify({
            'id': user['id'],
            'email': user['email'],
            'name': user['name'],
            'role': user['role'],
            'phone': user['phone'],
            'verified': user['verified'],
            'kyc_status': user['kyc_status'],
            'rating': user['rating']
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/vehicles', methods=['POST'])
@jwt_required()
def add_vehicle():
    try:
        user_id = get_user_id()
        data = request.json

        return jsonify({'id': 1, 'user_id': user_id})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    init_db()
    print("RunWise API Server starting on port 5001...")
    print("Access at http://localhost:5001")
    app.run(debug=True, port=5001, host='0.0.0.0')
