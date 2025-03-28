import quip
import sys
import logging
import traceback
import time
import os

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Disable debug logging for urllib3 to reduce noise
logging.getLogger('urllib3').setLevel(logging.WARNING)

def init_quip_client():
    """Initialize and return a Quip client"""
    logger.info("Initializing Quip client...")
    
    # Get token from environment variables
    access_token = os.environ.get('QUIP_ACCESS_TOKEN')
    base_url = os.environ.get('QUIP_BASE_URL', 'https://platform.quip-amazon.com')
    
    if not access_token:
        raise ValueError("QUIP_ACCESS_TOKEN environment variable is required")

    client = quip.QuipClient(
        access_token=access_token,
        base_url=base_url,
        request_timeout=60  # Increased timeout
    )

    # Verify authentication
    try:
        user = client.get_authenticated_user()
        logger.info(f"Successfully authenticated as user: {user.get('name', 'Unknown')}")
    except Exception as e:
        logger.error(f"Authentication failed: {str(e)}")
        raise

    return client

def read_document(client, thread_id):
    """Read the content of an existing Quip document"""
    logger.info(f"Attempting to read document with thread_id: {thread_id}")

    try:
        # Get thread data
        thread = client.get_thread(thread_id)
        logger.debug(f"Thread data: {thread}")

        # Extract HTML content
        if 'html' in thread:
            html_content = thread['html']
            logger.info(f"Successfully retrieved HTML content ({len(html_content)} characters)")
            return thread
        else:
            # Try alternative approach - get_blob
            logger.info("HTML not found in thread data, trying get_blob...")
            blob = client.get_blob(thread_id)
            logger.debug(f"Blob data: {blob}")
            return {"blob": blob}

    except Exception as e:
        logger.error(f"Error reading document: {str(e)}")
        logger.error("Traceback:", exc_info=True)
        raise

def edit_document(client, thread_id, content, operation="APPEND"):
    """Edit an existing Quip document"""
    logger.info(f"Attempting to edit document with thread_id: {thread_id}")
    logger.info(f"Operation: {operation}")

    try:
        # Make sure operation is valid
        valid_operations = ["APPEND", "PREPEND", "REPLACE"]
        if operation.upper() not in valid_operations:
            logger.error(f"Invalid operation: {operation}")
            raise ValueError(f"Invalid operation: {operation}")

        # Edit document - pass the operation string directly
        response = client.edit_document(
            thread_id=thread_id,
            content=content,
            format="markdown",
            operation=operation.upper()
        )

        logger.info("Document edited successfully")
        logger.debug(f"Response: {response}")
        return response

    except Exception as e:
        logger.error(f"Error editing document: {str(e)}")
        logger.error("Traceback:", exc_info=True)
        raise

def main():
    """Main function to demonstrate reading and editing a Quip document"""
    # Parse command line arguments
    if len(sys.argv) < 2:
        print("Usage: python quip_edit.py <thread_id> [operation] [content_file]")
        print("Operations: read, append, prepend, replace")
        print("Example: python quip_edit.py d6vQAAcgSyiR read")
        print("Example: python quip_edit.py d6vQAAcgSyiR append update_content.md")
        sys.exit(1)

    thread_id = sys.argv[1]
    operation = sys.argv[2].lower() if len(sys.argv) > 2 else "read"
    content_file = sys.argv[3] if len(sys.argv) > 3 and operation != "read" else None

    try:
        # Initialize client
        client = init_quip_client()

        # Perform requested operation
        if operation == "read":
            print(f"Reading document {thread_id}...")
            thread = read_document(client, thread_id)

            # Display document info
            if 'thread' in thread:
                print(f"\nDocument Title: {thread['thread'].get('title', 'Untitled')}")

            # Display content
            if 'html' in thread:
                print("\nDocument Content (HTML):")
                print("------------------------")
                print(thread['html'])
            elif 'blob' in thread:
                print("\nDocument Content (Blob):")
                print("------------------------")
                print(thread['blob'][:1000] + "..." if len(thread['blob']) > 1000 else thread['blob'])
                print("\n(Content may be truncated for display)")
            else:
                print("\nNo content found in document")

        elif operation in ["append", "prepend", "replace"]:
            if not content_file:
                content = f"""
## Added via API
This content was added to the document using the Quip API at {time.strftime('%Y-%m-%d %H:%M:%S')}

* Operation: {operation.upper()}
* Thread ID: {thread_id}
* Updated by: Claude
"""
            else:
                try:
                    with open(content_file, 'r') as f:
                        content = f.read()
                except Exception as e:
                    print(f"Error reading content file: {str(e)}")
                    sys.exit(1)

            print(f"{operation.capitalize()}ing content to document {thread_id}...")
            response = edit_document(client, thread_id, content, operation.upper())
            print(f"Document updated successfully!")

        else:
            print(f"Unknown operation: {operation}")
            print("Valid operations: read, append, prepend, replace")
            sys.exit(1)

    except Exception as e:
        print(f"Error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
